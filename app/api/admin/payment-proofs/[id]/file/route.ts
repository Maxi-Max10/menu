import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, unauthorized } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireSession("admin"))) return unauthorized();
  try {
    const { id } = await params;
    z.string().uuid().parse(id);
    const { rows } = await query<{ file_data: Buffer; mime_type: string; filename: string }>("SELECT file_data, mime_type, filename FROM payment_proofs WHERE id = $1", [id]);
    if (!rows[0]) return NextResponse.json({ error: "Comprobante no encontrado" }, { status: 404 });
    const file = rows[0];
    const disposition = `attachment; filename="${file.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}"`;
    return new NextResponse(new Uint8Array(file.file_data), { headers: {
      "Content-Type": file.mime_type, "Content-Disposition": disposition,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    } });
  } catch (error) { return apiError(error); }
}
