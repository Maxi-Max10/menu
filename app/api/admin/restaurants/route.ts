import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { requireSession } from "@/lib/auth";
import { query, transaction } from "@/lib/db";
import { restaurantCreateSchema } from "@/lib/validation";
import { apiError, rejectCrossOrigin, unauthorized } from "@/lib/api";
import { addCalendarMonth } from "@/lib/billing";
import type { Restaurant } from "@/lib/types";

export async function GET() {
  if (!(await requireSession("admin"))) return unauthorized();
  try {
    const { rows } = await query<Restaurant>(`SELECT r.*, u.email AS owner_email, u.phone AS owner_phone, COUNT(p.id)::int AS product_count,
      (r.paid_until IS NOT NULL AND NOT EXISTS (SELECT 1 FROM payments pay WHERE pay.restaurant_id = r.id)) AS is_trial
      FROM restaurants r LEFT JOIN users u ON u.restaurant_id = r.id LEFT JOIN products p ON p.restaurant_id = r.id
      GROUP BY r.id, u.email, u.phone ORDER BY r.created_at DESC`);
    return NextResponse.json({ restaurants: rows });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  if (!(await requireSession("admin"))) return unauthorized();
  try {
    const data = restaurantCreateSchema.parse(await request.json());
    const restaurantId = randomUUID();
    const userId = randomUUID();
    const hash = await bcrypt.hash(data.password, 12);
    const trialEndsAt = addCalendarMonth(new Date());
    await transaction(async (client) => {
      await client.query("INSERT INTO restaurants (id, name, slug, type, plan, paid_until, orders_enabled) VALUES ($1, $2, $3, $4, $5, $6, $7)", [restaurantId, data.name, data.slug, data.type, data.plan, trialEndsAt, data.plan === "premium"]);
      await client.query("INSERT INTO users (id, restaurant_id, email, password_hash) VALUES ($1, $2, $3, $4)", [userId, restaurantId, data.email.toLowerCase(), hash]);
    });
    return NextResponse.json({ id: restaurantId, trial_ends_at: trialEndsAt.toISOString() }, { status: 201 });
  } catch (error) { return apiError(error); }
}
