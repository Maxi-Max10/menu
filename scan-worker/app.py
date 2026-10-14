"""Private Polo photogrammetry worker. Photos and models stay on this host."""

import json
import os
import shutil
import subprocess
import sys
import time
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from uuid import UUID

import httpx
import jwt
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from PIL import Image, UnidentifiedImageError

DATA = Path(os.environ.get("SCAN_DATA_DIR", "/data")).resolve()
JOBS = DATA / "jobs"
MODELS = DATA / "models"
SECRET = os.environ.get("SCAN_WORKER_SECRET", "")
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "").rstrip("/")
CALLBACK_URL = os.environ.get("POLO_CALLBACK_URL", "")
ORIGIN = os.environ.get("POLO_ORIGIN", "")

if (len(SECRET) < 32 or not PUBLIC_BASE_URL.startswith("https://") or
        not CALLBACK_URL.startswith("https://") or not ORIGIN.startswith("https://")):
    raise RuntimeError("Configurá SCAN_WORKER_SECRET, PUBLIC_BASE_URL, POLO_CALLBACK_URL y POLO_ORIGIN HTTPS")

JOBS.mkdir(parents=True, exist_ok=True)
MODELS.mkdir(parents=True, exist_ok=True)
executor = ThreadPoolExecutor(max_workers=1)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    resume_queued()
    yield


app = FastAPI(docs_url=None, redoc_url=None, lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=[ORIGIN], allow_methods=["GET", "POST"],
                   allow_headers=["Authorization", "Content-Type", "Range"])


def state_path(scan_id: str) -> Path:
    return JOBS / scan_id / "status.json"


def save_state(scan_id: str, status: str, error: str | None = None):
    target = state_path(scan_id)
    temporary = target.with_suffix(".tmp")
    temporary.write_text(json.dumps({"status": status, "error": error}), encoding="utf-8")
    temporary.replace(target)


def notify(scan_id: str, status: str, error: str | None = None):
    payload = {"id": scan_id, "status": status}
    if error:
        payload["error"] = error[:500]
    if status == "completed":
        payload["modelUrl"] = f"{PUBLIC_BASE_URL}/models/{scan_id}.glb"
    for attempt in range(5):
        try:
            with httpx.Client(timeout=20) as client:
                response = client.post(CALLBACK_URL, json=payload,
                                       headers={"Authorization": f"Bearer {SECRET}"})
                response.raise_for_status()
            return
        except httpx.HTTPError:
            time.sleep(min(2 ** attempt, 16))


def set_status(scan_id: str, status: str, error: str | None = None):
    save_state(scan_id, status, error)
    notify(scan_id, status, error)


def run(command: list[str], log: Path, timeout: int):
    with log.open("a", encoding="utf-8") as output:
        output.write("Running: " + " ".join(command[:2]) + "\n")
        result = subprocess.run(command, stdout=output, stderr=subprocess.STDOUT,
                                timeout=timeout, check=False)
    if result.returncode != 0:
        raise RuntimeError(f"Falló {command[1]} (código {result.returncode})")


def process(scan_id: str, diameter_cm: int):
    workspace = JOBS / scan_id
    log = workspace / "processing.log"
    try:
        set_status(scan_id, "processing")
        run(["colmap", "automatic_reconstructor", "--workspace_path", str(workspace),
             "--image_path", str(workspace / "images"), "--quality", "MEDIUM",
             "--data_type", "INDIVIDUAL"], log, 7200)
        dense = workspace / "dense" / "0"
        mesh = dense / "meshed-poisson.ply"
        if not mesh.exists():
            raise RuntimeError("Las fotos no permitieron reconstruir una malla")
        simplified = dense / "meshed-mobile.ply"
        run(["colmap", "mesh_simplifier", "--input_path", str(mesh),
             "--output_path", str(simplified), "--MeshSimplification.target_face_ratio", "0.25"], log, 1800)
        textured = dense / "textured"
        run(["colmap", "mesh_texturer", "--workspace_path", str(dense),
             "--input_path", str(simplified), "--output_path", str(textured)], log, 3600)
        if not (textured / "mesh.ply").exists() or not (textured / "texture.png").exists():
            raise RuntimeError("No se pudo aplicar la textura fotográfica")
        sparse_txt = workspace / "sparse-txt"
        sparse_txt.mkdir(exist_ok=True)
        run(["colmap", "model_converter", "--input_path", str(dense / "sparse"),
             "--output_path", str(sparse_txt), "--output_type", "TXT"], log, 120)
        target = MODELS / f"{scan_id}.glb"
        run([sys.executable, str(Path(__file__).with_name("convert.py")),
             str(textured / "mesh.ply"), str(textured / "texture.png"), str(target),
             str(diameter_cm), str(sparse_txt / "images.txt")], log, 1800)
        set_status(scan_id, "completed")
    except (RuntimeError, subprocess.TimeoutExpired, OSError, ValueError) as error:
        set_status(scan_id, "failed", str(error))
    finally:
        shutil.rmtree(workspace / "images", ignore_errors=True)


def resume_queued():
    for state_file in JOBS.glob("*/status.json"):
        state = json.loads(state_file.read_text(encoding="utf-8"))
        if state["status"] in ("queued", "processing"):
            metadata = json.loads((state_file.parent / "meta.json").read_text(encoding="utf-8"))
            executor.submit(process, state_file.parent.name, metadata["diameter_cm"])


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/jobs/{scan_id}")
def get_job(scan_id: str, x_worker_key: str = Header("")):
    if x_worker_key != SECRET:
        raise HTTPException(401, "No autorizado")
    try:
        scan_id = str(UUID(scan_id))
    except ValueError:
        raise HTTPException(404, "Captura no encontrada") from None
    target = state_path(scan_id)
    if not target.is_file():
        raise HTTPException(404, "Captura no encontrada")
    state = json.loads(target.read_text(encoding="utf-8"))
    if state["status"] == "completed":
        state["modelUrl"] = f"{PUBLIC_BASE_URL}/models/{scan_id}.glb"
    return state


@app.post("/jobs", status_code=202)
async def create_job(photos: list[UploadFile] = File(...), authorization: str = Header("")):
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Falta autorización")
    try:
        claims = jwt.decode(authorization[7:], SECRET, algorithms=["HS256"],
                            audience="polo-scan-worker", issuer="polo")
        scan_id = str(UUID(claims["sub"]))
        diameter_cm = int(claims["diameterCm"])
        if claims.get("purpose") != "upload" or not 15 <= diameter_cm <= 45:
            raise ValueError("Token inválido")
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(401, "Token inválido") from None
    if not 20 <= len(photos) <= 50:
        raise HTTPException(400, "Se necesitan entre 20 y 50 fotos")
    workspace = JOBS / scan_id
    try:
        workspace.mkdir()
    except FileExistsError:
        raise HTTPException(409, "La captura ya fue recibida") from None
    images = workspace / "images"
    images.mkdir()
    try:
        total_bytes = 0
        for index, upload in enumerate(photos):
            if upload.content_type not in ("image/jpeg", "image/png", "image/webp"):
                raise HTTPException(400, "Formato de foto inválido")
            target = images / f"{index:03d}.jpg"
            contents = await upload.read(12 * 1024 * 1024 + 1)
            if len(contents) > 12 * 1024 * 1024 or not contents:
                raise HTTPException(400, "Foto demasiado grande o vacía")
            total_bytes += len(contents)
            if total_bytes > 180 * 1024 * 1024:
                raise HTTPException(400, "Las fotos superan 180 MB")
            try:
                from io import BytesIO
                with Image.open(BytesIO(contents)) as image:
                    image.verify()
                with Image.open(BytesIO(contents)) as image:
                    if image.width < 800 or image.height < 800:
                        raise HTTPException(400, "Las fotos deben medir al menos 800 píxeles por lado")
                    if image.width * image.height > 30_000_000:
                        raise HTTPException(400, "La resolución de una foto es demasiado grande")
                    image.convert("RGB").save(target, quality=92)
            except (UnidentifiedImageError, OSError):
                raise HTTPException(400, "Una foto está dañada") from None
        (workspace / "meta.json").write_text(json.dumps({"diameter_cm": diameter_cm}), encoding="utf-8")
        save_state(scan_id, "queued")
        executor.submit(process, scan_id, diameter_cm)
        return {"id": scan_id, "status": "queued"}
    except Exception:
        shutil.rmtree(workspace, ignore_errors=True)
        raise


@app.get("/models/{scan_id}.glb")
def get_model(scan_id: str):
    try:
        scan_id = str(UUID(scan_id))
    except ValueError:
        raise HTTPException(404, "Modelo no encontrado") from None
    target = MODELS / f"{scan_id}.glb"
    if not target.is_file():
        raise HTTPException(404, "Modelo no encontrado")
    return FileResponse(target, media_type="model/gltf-binary")
