"""COLMAP textured PLY + atlas -> real-size, upright GLB for mobile AR."""

import sys
from pathlib import Path

import numpy as np
import trimesh
from PIL import Image


def camera_centers(images_txt: Path) -> np.ndarray:
    if not images_txt.exists():
        return np.empty((0, 3))
    centers = []
    lines = [line for line in images_txt.read_text(encoding="utf-8").splitlines()
             if not line.startswith("#")]
    for line in lines[::2]:
        parts = line.split()
        if len(parts) < 10:
            continue
        try:
            float(parts[0])
            q = np.array([float(n) for n in parts[1:5]])
            t = np.array([float(n) for n in parts[5:8]])
        except ValueError:
            continue
        q /= np.linalg.norm(q)
        w, x, y, z = q
        rotation = np.array([
            [1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)],
            [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)],
            [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)],
        ])
        centers.append(-rotation.T @ t)
    return np.array(centers) if centers else np.empty((0, 3))


def convert(source: Path, texture: Path, target: Path, diameter_cm: float, poses: Path | None = None):
    mesh = trimesh.load_mesh(source, process=False)
    if not isinstance(mesh, trimesh.Trimesh) or len(mesh.faces) == 0:
        raise ValueError("La reconstrucción no produjo una malla")
    if mesh.visual.kind != "texture" or mesh.visual.uv is None or not texture.exists():
        raise ValueError("La reconstrucción no produjo una textura fotográfica")
    mesh.visual.material.image = Image.open(texture).convert("RGB")

    # The flattest principal axis is the plate normal. Camera positions resolve
    # its sign so the photographed side faces up rather than appearing inverted.
    vertices = np.asarray(mesh.vertices)
    center = np.median(vertices, axis=0)
    covariance = np.cov((vertices - center).T)
    _, axes = np.linalg.eigh(covariance)
    up = axes[:, 0]
    if poses:
        cameras = camera_centers(poses)
        if len(cameras) and np.dot(up, np.mean(cameras, axis=0) - center) < 0:
            up = -up
    right = axes[:, 2]
    forward = np.cross(right, up)
    rotation = np.stack((right, up, forward))
    mesh.vertices = (rotation @ vertices.T).T

    low, high = mesh.bounds
    horizontal = max(high[0] - low[0], high[2] - low[2])
    if not np.isfinite(horizontal) or horizontal <= 0:
        raise ValueError("La malla no tiene dimensiones válidas")
    mesh.apply_scale((diameter_cm / 100) / horizontal)
    low, high = mesh.bounds
    mesh.apply_translation((-(low[0] + high[0]) / 2, -low[1], -(low[2] + high[2]) / 2))

    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(mesh.export(file_type="glb"))
    if target.stat().st_size == 0:
        raise ValueError("No se pudo exportar el GLB")


if __name__ == "__main__":
    args = sys.argv[1:]
    convert(Path(args[0]), Path(args[1]), Path(args[2]), float(args[3]),
            Path(args[4]) if len(args) > 4 else None)
