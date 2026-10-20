import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { apiError, rejectCrossOrigin, unauthorized } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { validPaymentLink } from "@/lib/billing-notice";
import { query, transaction } from "@/lib/db";
import { limitedBody, MAX_PROOF_BYTES, proofMime } from "@/lib/payment-proof";
import { PLANS, type Plan } from "@/lib/types";

type ProofStatus = { id: string; status: "pending" | "rejected" | "approved"; submitted_at: Date; period_due_at: Date };

export async function GET() {
  const session = await requireSession("restaurant");
  if (!session?.restaurantId) return unauthorized();
  try {
    const { rows } = await query<ProofStatus & { payment_url: string | null }>(`SELECT pp.id, pp.status, pp.submitted_at, pp.period_due_at,
      CASE WHEN r.plan = 'basic' THEN bs.basic_url ELSE bs.premium_url END AS payment_url
      FROM restaurants r LEFT JOIN payment_proofs pp ON pp.restaurant_id = r.id AND pp.period_due_at = r.paid_until
      LEFT JOIN billing_settings bs ON bs.id = true
      WHERE r.id = $1`, [session.restaurantId]);
    return NextResponse.json({ proof: rows[0]?.id ? rows[0] : null,
      paymentUrl: rows[0]?.payment_url && validPaymentLink(rows[0].payment_url) ? rows[0].payment_url : null },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  const session = await requireSession("restaurant");
  if (!session?.restaurantId) return unauthorized();
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) return NextResponse.json({ error: "Seleccioná una imagen o PDF." }, { status: 400 });
  try {
    const body = await limitedBody(request, MAX_PROOF_BYTES + 8192);
    if (!body) return NextResponse.json({ error: "El archivo no puede superar 4 MB." }, { status: 413 });
    const form = await new Request(request.url, { method: "POST", headers: { "content-type": request.headers.get("content-type")! }, body: Buffer.from(body) }).formData();
    const file = form.get("proof");
    if (!(file instanceof File) || file.size < 100 || file.size > MAX_PROOF_BYTES) return NextResponse.json({ error: "Elegí un archivo de hasta 4 MB." }, { status: 400 });
    const bytes = Buffer.from(await file.arrayBuffer());
    const mime = proofMime(bytes);
    if (!mime || mime !== file.type) return NextResponse.json({ error: "Solo se aceptan JPG, PNG o PDF válidos." }, { status: 400 });
    const filename = file.name.replace(/[\\/\r\n\x00-\x1f]/g, "_").slice(0, 120) || "comprobante";
    const result = await transaction(async (client) => {
      const account = await client.query<{ paid_until: Date | null; signup_status: string; plan: Plan }>("SELECT paid_until, signup_status, plan FROM restaurants WHERE id = $1 FOR UPDATE", [session.restaurantId]);
      if (!account.rows[0]?.paid_until || account.rows[0].signup_status !== "active") return "not-due";
      if (new Date(account.rows[0].paid_until).getTime() > Date.now()) return "not-due";
      if (!PLANS[account.rows[0].plan]) return "not-due";
      const saved = await client.query(`INSERT INTO payment_proofs (id, restaurant_id, period_due_at, plan, filename, mime_type, file_data)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (restaurant_id, period_due_at) DO UPDATE SET
          plan = EXCLUDED.plan, filename = EXCLUDED.filename, mime_type = EXCLUDED.mime_type, file_data = EXCLUDED.file_data,
          status = 'pending', submitted_at = now(), reviewed_at = NULL
          WHERE payment_proofs.status = 'rejected'
        RETURNING id`, [randomUUID(), session.restaurantId, account.rows[0].paid_until, account.rows[0].plan, filename, mime, bytes]);
      return saved.rowCount ? "ok" : "already-submitted";
    });
    if (result === "not-due") return NextResponse.json({ error: "La cuota todavía no venció." }, { status: 409 });
    if (result === "already-submitted") return NextResponse.json({ error: "Ya hay un comprobante pendiente o aprobado para esta cuota." }, { status: 409 });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) { return apiError(error); }
}
