import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, rejectCrossOrigin, unauthorized } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { sendBillingNotice, validPaymentLink } from "@/lib/billing-notice";
import { query, transaction } from "@/lib/db";
import { PLANS, type Plan } from "@/lib/types";

type BillingAccount = { name: string; plan: Plan; paid_until: Date | null; signup_status: string; owner_email: string | null };

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  if (!(await requireSession("admin"))) return unauthorized();
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    return NextResponse.json({ error: "Configurá el correo SMTP antes de enviar avisos." }, { status: 503 });
  }

  try {
    const { id } = await params;
    z.string().uuid().parse(id);
    const result = await transaction(async (client) => {
      const found = await client.query<BillingAccount>(`
        SELECT r.name, r.plan, r.paid_until, r.signup_status,
          (SELECT u.email FROM users u WHERE u.restaurant_id = r.id ORDER BY u.created_at LIMIT 1) AS owner_email
        FROM restaurants r WHERE r.id = $1 FOR UPDATE`, [id]);
      const account = found.rows[0];
      if (!account) return { reason: "missing" as const };
      if (account.signup_status !== "active" || !account.paid_until || new Date(account.paid_until).getTime() > Date.now()) return { reason: "not-due" as const };
      if (!account.owner_email || !PLANS[account.plan]) return { reason: "missing-owner" as const };
      const settings = await client.query<{ basic_url: string; premium_url: string }>("SELECT basic_url, premium_url FROM billing_settings WHERE id = true");
      const paymentUrl = account.plan === "basic" ? settings.rows[0]?.basic_url : settings.rows[0]?.premium_url;
      if (!paymentUrl || !validPaymentLink(paymentUrl)) return { reason: "no-link" as const };
      const noticeId = randomUUID();
      const claim = await client.query<{ id: string }>(`INSERT INTO billing_notices (id, restaurant_id, period_due_at, plan, amount, payment_url, recipient_email, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'sending')
        ON CONFLICT (restaurant_id, period_due_at) DO UPDATE SET
          status = 'sending', plan = EXCLUDED.plan, amount = EXCLUDED.amount,
          payment_url = EXCLUDED.payment_url, recipient_email = EXCLUDED.recipient_email,
          created_at = now()
          WHERE billing_notices.status = 'failed'
        RETURNING id`, [noticeId, id, account.paid_until, account.plan, PLANS[account.plan].price, paymentUrl, account.owner_email]);
      if (!claim.rowCount) return { reason: "already-sent" as const };
      return { reason: "ready" as const, noticeId: claim.rows[0].id, account, paymentUrl };
    });
    if (result.reason === "missing") return NextResponse.json({ error: "Local no encontrado" }, { status: 404 });
    if (result.reason === "not-due") return NextResponse.json({ error: "La cuota todavía no venció." }, { status: 409 });
    if (result.reason === "missing-owner") return NextResponse.json({ error: "Falta el correo del local." }, { status: 409 });
    if (result.reason === "no-link") return NextResponse.json({ error: "Configurá el enlace de Mercado Pago para este plan." }, { status: 409 });
    if (result.reason === "already-sent") return NextResponse.json({ error: "El aviso de esta cuota ya se envió o está en proceso." }, { status: 409 });
    try {
      await sendBillingNotice({ email: result.account.owner_email!, restaurantName: result.account.name,
        plan: result.account.plan, paymentUrl: result.paymentUrl, dueAt: new Date(result.account.paid_until!) });
    } catch (error) {
      await query("UPDATE billing_notices SET status = 'failed' WHERE id = $1", [result.noticeId]).catch(console.error);
      return apiError(error);
    }
    await query("UPDATE billing_notices SET status = 'sent', sent_at = now() WHERE id = $1", [result.noticeId]);
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
