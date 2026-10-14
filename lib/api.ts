import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function apiError(error: unknown) {
  if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Datos inválidos" }, { status: 400 });
  if (error instanceof SyntaxError) return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  if (error instanceof Error && error.message.includes("duplicate key")) return NextResponse.json({ error: "El enlace o correo ya está en uso" }, { status: 409 });
  console.error(error);
  return NextResponse.json({ error: "No se pudo completar la operación" }, { status: 500 });
}

export function unauthorized() { return NextResponse.json({ error: "Iniciá sesión para continuar" }, { status: 401 }); }
