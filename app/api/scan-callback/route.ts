import { NextResponse } from "next/server";
import { z } from "zod";
import { transaction } from "@/lib/db";
import { scanConfig } from "@/lib/scan-config";
import { apiError } from "@/lib/api";

const callbackSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["queued", "processing", "completed", "failed"]),
  error: z.string().max(500).optional(),
  modelUrl: z.string().url().optional(),
});

export async function POST(request: Request) {
  const config = scanConfig();
  if (!config || request.headers.get("authorization") !== `Bearer ${config.secret}`)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const data = callbackSchema.parse(await request.json());
    if (data.status === "completed" && data.modelUrl !== `${config.url}/models/${data.id}.glb`)
      return NextResponse.json({ error: "URL de modelo inválida" }, { status: 400 });
    const status = await transaction(async (client) => {
      const result = await client.query<{ status: string }>(
        "SELECT status FROM model_scans WHERE id = $1 FOR UPDATE", [data.id]);
      const scan = result.rows[0];
      if (!scan) return "missing";
      if (scan.status === "completed" || scan.status === "failed") return "done";
      await client.query(
        `UPDATE model_scans SET status = $1, error = $2, model_url = $3, updated_at = now() WHERE id = $4`,
        [data.status, data.status === "failed" ? data.error || "No se pudo reconstruir el modelo." : null,
          data.status === "completed" ? data.modelUrl : null, data.id]);
      return "ok";
    });
    if (status === "missing") return NextResponse.json({ error: "Captura no encontrada" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
