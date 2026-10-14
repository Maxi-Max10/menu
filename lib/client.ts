export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Ocurrió un error. Intentá de nuevo.");
  return body as T;
}

export async function compressImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Elegí una imagen válida.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const data = canvas.toDataURL("image/webp", 0.75);
  bitmap.close();
  if (data.length > 450_000) throw new Error("La imagen es demasiado grande. Probá con una más pequeña.");
  return data;
}
