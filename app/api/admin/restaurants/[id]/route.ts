import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { requireSession } from "@/lib/auth";
import { query, transaction } from "@/lib/db";
import { apiError, unauthorized } from "@/lib/api";
import { PLANS, type Restaurant } from "@/lib/types";

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("set-enabled"), enabled: z.boolean() }),
  z.object({ action: z.literal("set-plan"), plan: z.enum(["basic", "premium"]) }),
  z.object({ action: z.literal("record-payment"), note: z.string().max(200).optional() }),
]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await requireSession("admin"))) return unauthorized();
  try {
    const { id } = await context.params;
    const data = patchSchema.parse(await request.json());
    if (data.action === "set-enabled") {
      const result = await query("UPDATE restaurants SET is_enabled = $1 WHERE id = $2", [data.enabled, id]);
      if (!result.rowCount) return NextResponse.json({ error: "Local no encontrado" }, { status: 404 });
    } else if (data.action === "set-plan") {
      const outcome = await transaction(async (client) => {
        const found = await client.query("SELECT id FROM restaurants WHERE id = $1 FOR UPDATE", [id]);
        if (!found.rowCount) return "missing";
        if (data.plan === "basic") {
          const check = await client.query<{ count: string; models: string }>("SELECT COUNT(*)::text AS count, COUNT(*) FILTER (WHERE model_url IS NOT NULL)::text AS models FROM products WHERE restaurant_id = $1", [id]);
          if (Number(check.rows[0].count) > PLANS.basic.limit || Number(check.rows[0].models) > 0) return "limit";
        }
        await client.query("UPDATE restaurants SET plan = $1 WHERE id = $2", [data.plan, id]);
        return "ok";
      });
      if (outcome === "missing") return NextResponse.json({ error: "Local no encontrado" }, { status: 404 });
      if (outcome === "limit") return NextResponse.json({ error: "Para pasar a Esencial, dejá hasta 100 productos y quitá los modelos 3D." }, { status: 409 });
    } else {
      const outcome = await transaction(async (client) => {
        const found = await client.query<Restaurant>("SELECT * FROM restaurants WHERE id = $1 FOR UPDATE", [id]);
        const restaurant = found.rows[0];
        if (!restaurant) return "missing";
        const currentEnd = restaurant.paid_until && new Date(restaurant.paid_until).getTime() > Date.now() ? new Date(restaurant.paid_until) : new Date();
        const nextEnd = addCalendarMonth(currentEnd);
        await client.query("UPDATE restaurants SET paid_until = $1, is_enabled = true WHERE id = $2", [nextEnd, id]);
        await client.query("INSERT INTO payments (id, restaurant_id, amount, period_end, note) VALUES ($1, $2, $3, $4, $5)", [randomUUID(), id, PLANS[restaurant.plan].price, nextEnd, data.note || ""]);
        return "ok";
      });
      if (outcome === "missing") return NextResponse.json({ error: "Local no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}

function addCalendarMonth(date: Date) {
  const next = new Date(date);
  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return next;
}
