import { NextResponse } from "next/server";
import { ZodError } from "zod";

class PayloadTooLarge extends Error {}

export function apiError(error: unknown) {
  if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Datos inválidos" }, { status: 400 });
  if (error instanceof SyntaxError) return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  if (error instanceof PayloadTooLarge) return NextResponse.json({ error: "Solicitud demasiado grande" }, { status: 413 });
  if (error instanceof Error && error.message.includes("duplicate key")) return NextResponse.json({ error: "El enlace o correo ya está en uso" }, { status: 409 });
  console.error(error);
  return NextResponse.json({ error: "No se pudo completar la operación" }, { status: 500 });
}

export function unauthorized() { return NextResponse.json({ error: "Iniciá sesión para continuar" }, { status: 401 }); }

export async function readJsonLimited(request: Request, maxBytes = 4096): Promise<unknown> {
  if (Number(request.headers.get("content-length") || 0) > maxBytes) throw new PayloadTooLarge();
  if (!request.body) throw new SyntaxError("JSON vacío");
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let content = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) { await reader.cancel(); throw new PayloadTooLarge(); }
    content += decoder.decode(value, { stream: true });
  }
  return JSON.parse(content + decoder.decode());
}

export function rejectCrossOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (origin !== new URL(request.url).origin || fetchSite === "cross-site") {
    return NextResponse.json({ error: "Origen inválido" }, { status: 403 });
  }
  return null;
}
