import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { query, transaction } from "@/lib/db";
import { apiError, rejectCrossOrigin, unauthorized } from "@/lib/api";
import { PLANS, type Restaurant } from "@/lib/types";
import { nextPeriodEnd } from "@/lib/billing";

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("set-enabled"), enabled: z.boolean() }),
  z.object({ action: z.literal("set-plan"), plan: z.enum(["basic", "premium"]) }),
  z.object({ action: z.literal("activate-trial") }),
]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  if (!(await requireSession("admin"))) return unauthorized();
  try {
    const { id } = await context.params;
    const data = patchSchema.parse(await request.json());
    if (data.action === "activate-trial") {
      const outcome = await transaction(async (client) => {
        const found = await client.query<Restaurant>("SELECT * FROM restaurants WHERE id = $1 FOR UPDATE", [id]);
        const restaurant = found.rows[0];
        if (!restaurant) return "missing";
        if (restaurant.signup_status !== "pending" || restaurant.paid_until) return "already-active";
        await client.query("UPDATE restaurants SET signup_status = 'active', is_enabled = true, paid_until = $1 WHERE id = $2", [nextPeriodEnd(null), id]);
        await client.query("DELETE FROM email_verifications WHERE user_id IN (SELECT id FROM users WHERE restaurant_id = $1)", [id]);
        return "ok";
      });
      if (outcome === "missing") return NextResponse.json({ error: "Local no encontrado" }, { status: 404 });
      if (outcome === "already-active") return NextResponse.json({ error: "La prueba ya fue activada" }, { status: 409 });
    } else if (data.action === "set-enabled") {
      const result = await query("UPDATE restaurants SET is_enabled = $1 WHERE id = $2 AND signup_status = 'active'", [data.enabled, id]);
      if (!result.rowCount) return NextResponse.json({ error: "Local no encontrado" }, { status: 404 });
    } else if (data.action === "set-plan") {
      const outcome = await transaction(async (client) => {
        const found = await client.query("SELECT id FROM restaurants WHERE id = $1 FOR UPDATE", [id]);
        if (!found.rowCount) return "missing";
        if (data.plan === "basic") {
          const check = await client.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM products WHERE restaurant_id = $1", [id]);
          if (Number(check.rows[0].count) > PLANS.basic.limit) return "limit";
          await client.query("UPDATE products SET featured = false, promo_price = NULL WHERE restaurant_id = $1", [id]);
        }
        await client.query("UPDATE restaurants SET plan = $1, orders_enabled = CASE WHEN $1 = 'basic' THEN false ELSE orders_enabled END WHERE id = $2", [data.plan, id]);
        return "ok";
      });
      if (outcome === "missing") return NextResponse.json({ error: "Local no encontrado" }, { status: 404 });
      if (outcome === "limit") return NextResponse.json({ error: "Para pasar a Esencial, dejá hasta 100 productos." }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
