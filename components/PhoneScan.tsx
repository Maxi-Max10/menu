"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { Camera, Images, RotateCcw } from "lucide-react";
import { api } from "@/lib/client";
import { ModelViewer } from "@/components/ModelViewer";

type Scan = { id: string; status: string; error: string | null; model_url: string | null };
type Photo = { file: File; preview: string };

export function PhoneScan({ productId, currentModelUrl, onPublished }: { productId: string; currentModelUrl: string | null; onPublished: (url: string) => void }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [diameterCm, setDiameterCm] = useState(28);
  const [scan, setScan] = useState<Scan | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const previews = useRef(new Set<string>());

  useEffect(() => () => { for (const url of previews.current) URL.revokeObjectURL(url); }, []);

  const refresh = useCallback(async () => {
    try {
      const result = await api<{ scan: Scan | null; enabled: boolean }>(`/api/products/${productId}/scans`);
      setScan(result.scan);
      setEnabled(result.enabled);
    } catch (issue) { setError(issue instanceof Error ? issue.message : "No se pudo consultar la captura"); }
  }, [productId]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!scan || !["awaiting_upload", "queued", "processing"].includes(scan.status)) return;
    const timer = window.setInterval(() => { void refresh(); }, 15000);
    return () => window.clearInterval(timer);
  }, [scan, refresh]);

  function addPhotos(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";
    if (!selected.length) return;
    if (photos.length + selected.length > 50) { setError("Podés usar hasta 50 fotos."); return; }
    if (photos.reduce((sum, photo) => sum + photo.file.size, 0) + selected.reduce((sum, file) => sum + file.size, 0) > 180 * 1024 * 1024) {
      setError("Las fotos juntas no pueden superar 180 MB. Usá menos fotos o bajá la resolución de la cámara."); return;
    }
    if (selected.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 12 * 1024 * 1024)) {
      setError("Cada foto debe ser JPG, PNG o WebP y pesar menos de 12 MB."); return;
    }
    const added = selected.map((file) => {
      const preview = URL.createObjectURL(file);
      previews.current.add(preview);
      return { file, preview };
    });
    setPhotos((old) => [...old, ...added]);
    setError("");
  }

  function removePhoto(index: number) {
    const photo = photos[index];
    if (photo) { URL.revokeObjectURL(photo.preview); previews.current.delete(photo.preview); }
    setPhotos((old) => old.filter((_, i) => i !== index));
  }

  async function start() {
    setError("");
    if (photos.length < 20) { setError("Necesitás al menos 20 fotos desde distintos ángulos."); return; }
    setBusy(true);
    try {
      const started = await api<{ id: string; uploadUrl: string; token: string }>(`/api/products/${productId}/scans`, {
        method: "POST", body: JSON.stringify({ diameterCm }),
      });
      setScan({ id: started.id, status: "awaiting_upload", error: null, model_url: null });
      const body = new FormData();
      for (const photo of photos) body.append("photos", photo.file, photo.file.name);
      const response = await fetch(started.uploadUrl, { method: "POST", headers: { Authorization: `Bearer ${started.token}` }, body });
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        await api(`/api/products/${productId}/scans/${started.id}/cancel`, { method: "DELETE" }).catch(() => null);
        throw new Error(detail?.detail || "No se pudieron enviar las fotos al procesador de Polo.");
      }
      setPhotos([]);
      for (const url of previews.current) URL.revokeObjectURL(url);
      previews.current.clear();
      await refresh();
    } catch (issue) { setError(issue instanceof Error ? issue.message : "No se pudo iniciar la captura"); await refresh(); }
    finally { setBusy(false); }
  }

  async function publish() {
    if (!scan) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ modelUrl: string }>(`/api/products/${productId}/scans/${scan.id}/publish`, { method: "POST" });
      onPublished(result.modelUrl);
    } catch (issue) { setError(issue instanceof Error ? issue.message : "No se pudo publicar el modelo"); }
    finally { setBusy(false); }
  }

  const active = scan && ["awaiting_upload", "queued", "processing"].includes(scan.status);
  return <div className="phone-scan">
    <strong>Crear 3D con el celular</strong>
    {!enabled ? <p>La captura estará disponible cuando se conecte el procesador 3D de Polo.</p> : <>
      <p>Fotografiá el plato 20 a 50 veces, rodeándolo en dos alturas. Usá luz pareja, un fondo simple y mantené el plato quieto. La reconstrucción puede tardar varios minutos.</p>
      {active ? <div className="scan-state" role="status"><RotateCcw size={18} /> {scan.status === "awaiting_upload" ? "Esperando las fotos…" : scan.status === "queued" ? "En cola para procesar…" : "Reconstruyendo el plato…"}</div> : <>
        <div className="scan-capture-actions">
          <label className="mini-button upload-button"><Camera size={16} /> Tomar foto<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden onChange={addPhotos} /></label>
          <label className="mini-button upload-button"><Images size={16} /> Elegir varias<input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={addPhotos} /></label>
        </div>
        <span className="scan-count">{photos.length} de 20 fotos mínimas · máximo 50</span>
        {!!photos.length && <div className="scan-photos">{photos.map((photo, index) => <button type="button" key={photo.preview} onClick={() => removePhoto(index)} title="Quitar foto" aria-label={`Quitar foto ${index + 1}`}><img src={photo.preview} alt="" /></button>)}</div>}
        <label className="scan-diameter">Diámetro real del plato (cm)<input type="number" min={15} max={45} step={1} value={diameterCm} onChange={(event) => setDiameterCm(Number(event.target.value))} /></label>
        <button type="button" className="button button-dark" disabled={busy || photos.length < 20 || diameterCm < 15 || diameterCm > 45} onClick={() => void start()}>{busy ? "Enviando fotos…" : "Generar modelo 3D"}</button>
      </>}
      {scan?.status === "completed" && scan.model_url && <div className="scan-review"><p className="scan-success" role="status">Modelo listo. Revisá cómo se ve y cuánto ocupa antes de publicarlo.</p><ModelViewer src={scan.model_url} alt="Vista previa del plato en 3D" />{currentModelUrl === scan.model_url ? <p className="scan-success">Publicado en tu carta.</p> : <button type="button" className="button button-dark" disabled={busy} onClick={() => void publish()}>{busy ? "Publicando…" : "Publicar 3D y AR"}</button>}</div>}
      {scan?.status === "failed" && <p className="form-error" role="alert">{scan.error || "No se pudo generar el modelo. Probá con fotos más nítidas."}</p>}
    </>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
