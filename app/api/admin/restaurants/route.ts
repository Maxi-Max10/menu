import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { requireSession } from "@/lib/auth";
import { query, transaction } from "@/lib/db";
import { restaurantCreateSchema } from "@/lib/validation";
import { apiError, unauthorized } from "@/lib/api";
import type { Restaurant } from "@/lib/types";

export async function GET() {
  if (!(await requireSession("admin"))) return unauthorized();
  try {
    const { rows } = await query<Restaurant>(`SELECT r.*, u.email AS owner_email, COUNT(p.id)::int AS product_count
      FROM restaurants r LEFT JOIN users u ON u.restaurant_id = r.id LEFT JOIN products p ON p.restaurant_id = r.id
      GROUP BY r.id, u.email ORDER BY r.created_at DESC`);
    return NextResponse.json({ restaurants: rows });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  if (!(await requireSession("admin"))) return unauthorized();
  try {
    const data = restaurantCreateSchema.parse(await request.json());
    const restaurantId = randomUUID();
    const userId = randomUUID();
    const hash = await bcrypt.hash(data.password, 12);
    await transaction(async (client) => {
      await client.query("INSERT INTO restaurants (id, name, slug, type, plan) VALUES ($1, $2, $3, $4, $5)", [restaurantId, data.name, data.slug, data.type, data.plan]);
      await client.query("INSERT INTO users (id, restaurant_id, email, password_hash) VALUES ($1, $2, $3, $4)", [userId, restaurantId, data.email.toLowerCase(), hash]);
    });
    return NextResponse.json({ id: restaurantId }, { status: 201 });
  } catch (error) { return apiError(error); }
}
