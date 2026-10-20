import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, rejectCrossOrigin, unauthorized } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { nextPeriodEnd } from "@/lib/billing";
import { transaction } from "@/lib/db";
import { PLANS, type Plan } from "@/lib/types";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  if (!(await requireSession("admin"))) return unauthorized();
  try {
    const { id } = await params;
    z.string().uuid().parse(id);
    const { action } = z.object({ action: z.enum(["approve", "reject"]) }).parse(await request.json());
    const outcome = await transaction(async (client) => {
      const owner = await client.query<{ restaurant_id: string }>("SELECT restaurant_id FROM payment_proofs WHERE id = $1", [id]);
      if (!owner.rows[0]) return "missing";
      const restaurant = await client.query<{ paid_until: Date | null; plan: Plan; signup_status: string }>("SELECT paid_until, plan, signup_status FROM restaurants WHERE id = $1 FOR UPDATE", [owner.rows[0].restaurant_id]);
      const proof = await client.query<{ period_due_at: Date; status: string; plan: Plan }>("SELECT period_due_at, status, plan FROM payment_proofs WHERE id = $1 FOR UPDATE", [id]);
      if (!proof.rows[0] || proof.rows[0].status !== "pending") return "already-reviewed";
      if (action === "reject") {
        await client.query("UPDATE payment_proofs SET status = 'rejected', reviewed_at = now() WHERE id = $1", [id]);
        return "ok";
      }
      const account = restaurant.rows[0];
      if (!account?.paid_until || account.signup_status !== "active" || account.plan !== proof.rows[0].plan || new Date(account.paid_until).getTime() !== new Date(proof.rows[0].period_due_at).getTime()) return "stale";
      const nextEnd = nextPeriodEnd(new Date(account.paid_until));
      await client.query("UPDATE restaurants SET paid_until = $1, is_enabled = true WHERE id = $2", [nextEnd, owner.rows[0].restaurant_id]);
      await client.query("INSERT INTO payments (id, restaurant_id, amount, period_end, note) VALUES ($1, $2, $3, $4, $5)",
        [randomUUID(), owner.rows[0].restaurant_id, PLANS[proof.rows[0].plan].price, nextEnd, `Comprobante ${id} verificado en Mercado Pago`]);
      await client.query("UPDATE payment_proofs SET status = 'approved', reviewed_at = now() WHERE id = $1", [id]);
      return "ok";
    });
    if (outcome === "missing") return NextResponse.json({ error: "Comprobante no encontrado" }, { status: 404 });
    if (outcome === "already-reviewed") return NextResponse.json({ error: "Este comprobante ya fue revisado." }, { status: 409 });
    if (outcome === "stale") return NextResponse.json({ error: "La cuota cambió. Revisá el estado del local antes de acreditar." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
