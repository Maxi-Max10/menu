import { randomUUID } from "crypto";
import { SignJWT } from "jose";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { apiError, unauthorized } from "@/lib/api";
import { query, transaction } from "@/lib/db";
import { scanConfig } from "@/lib/scan-config";

const startSchema = z.object({ diameterCm: z.number().int().min(15).max(45) });
const UUID = z.string().uuid();

type ScanRow = { id: string; status: string; error: string | null; model_url: string | null; created_at: string };

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireSession("restaurant");
  if (!session?.restaurantId) return unauthorized();
  try {
    const id = UUID.parse((await context.params).id);
    await query(
      `UPDATE model_scans SET status = 'failed', error = 'La carga de fotos venció. Podés intentarlo de nuevo.', updated_at = now()
       WHERE product_id = $1 AND restaurant_id = $2 AND status = 'awaiting_upload'
       AND created_at < now() - interval '15 minutes'`, [id, session.restaurantId]);
    const result = await query<ScanRow>(
      `SELECT s.id, s.status, s.error, s.model_url, s.created_at
       FROM model_scans s JOIN products p ON p.id = s.product_id
       WHERE s.product_id = $1 AND p.restaurant_id = $2
       ORDER BY s.created_at DESC LIMIT 1`, [id, session.restaurantId]);
    const scan = result.rows[0] ?? null;
    const config = scanConfig();
    if (scan && config && ["queued", "processing"].includes(scan.status)) {
      try {
        const response = await fetch(`${config.url}/jobs/${scan.id}`, {
          headers: { "X-Worker-Key": config.secret }, cache: "no-store", signal: AbortSignal.timeout(5000),
        });
        if (response.ok) {
          const remote = await response.json() as { status?: string; error?: string; modelUrl?: string };
          if (["queued", "processing", "completed", "failed"].includes(remote.status || "") &&
              (remote.status !== "completed" || remote.modelUrl === `${config.url}/models/${scan.id}.glb`)) {
            await query(
              `UPDATE model_scans SET status = $1, error = $2, model_url = $3, updated_at = now() WHERE id = $4`,
              [remote.status, remote.status === "failed" ? remote.error || "No se pudo reconstruir el modelo." : null,
                remote.status === "completed" ? remote.modelUrl : null, scan.id]);
            scan.status = remote.status!;
            scan.error = remote.status === "failed" ? remote.error || "No se pudo reconstruir el modelo." : null;
            scan.model_url = remote.status === "completed" ? remote.modelUrl! : null;
          }
        }
      } catch { /* Callback and subsequent polls can reconcile status later. */ }
    }
    return NextResponse.json({ scan, enabled: !!config });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireSession("restaurant");
  if (!session?.restaurantId) return unauthorized();
  try {
    const config = scanConfig();
    if (!config) return NextResponse.json({ error: "La captura 3D todavía no está configurada en Polo." }, { status: 503 });
    const productId = UUID.parse((await context.params).id);
    const { diameterCm } = startSchema.parse(await request.json());
    const scanId = randomUUID();
    const result = await transaction(async (client) => {
      const product = await client.query<{ plan: string }>(
        `SELECT r.plan FROM products p JOIN restaurants r ON r.id = p.restaurant_id
         WHERE p.id = $1 AND p.restaurant_id = $2 FOR UPDATE OF p`, [productId, session.restaurantId]);
      if (!product.rows[0]) return "missing";
      if (product.rows[0].plan !== "premium") return "premium";
      const active = await client.query(
        `SELECT id FROM model_scans WHERE product_id = $1 AND
         (status IN ('queued', 'processing') OR (status = 'awaiting_upload' AND created_at > now() - interval '15 minutes'))
         ORDER BY created_at DESC LIMIT 1`, [productId]);
      if (active.rowCount) return "active";
      await client.query(
        "INSERT INTO model_scans (id, restaurant_id, product_id, diameter_cm) VALUES ($1,$2,$3,$4)",
        [scanId, session.restaurantId, productId, diameterCm]);
      return "ok";
    });
    if (result === "missing") return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    if (result === "premium") return NextResponse.json({ error: "La captura 3D requiere Premium" }, { status: 403 });
    if (result === "active") return NextResponse.json({ error: "Ya hay una captura de este producto en curso" }, { status: 409 });
    const token = await new SignJWT({ purpose: "upload", productId, restaurantId: session.restaurantId, diameterCm })
      .setProtectedHeader({ alg: "HS256" }).setIssuer("polo").setAudience("polo-scan-worker")
      .setSubject(scanId).setIssuedAt().setExpirationTime("10m")
      .sign(new TextEncoder().encode(config.secret));
    return NextResponse.json({ id: scanId, uploadUrl: `${config.url}/jobs`, token }, { status: 201 });
  } catch (error) { return apiError(error); }
}
