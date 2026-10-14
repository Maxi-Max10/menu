import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireSession } from "@/lib/auth";
import { transaction } from "@/lib/db";
import { productSchema } from "@/lib/validation";
import { apiError, unauthorized } from "@/lib/api";
import { PLANS, type Plan } from "@/lib/types";

export async function POST(request: Request) {
  const session = await requireSession("restaurant");
  if (!session?.restaurantId) return unauthorized();
  try {
    const data = productSchema.parse(await request.json());
    const id = randomUUID();
    const result = await transaction(async (client) => {
      const restaurant = await client.query<{ plan: Plan }>("SELECT plan FROM restaurants WHERE id = $1 FOR UPDATE", [session.restaurantId]);
      if (!restaurant.rows[0]) return "missing";
      const plan = restaurant.rows[0].plan;
      const count = await client.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM products WHERE restaurant_id = $1", [session.restaurantId]);
      if (Number(count.rows[0].count) >= PLANS[plan].limit) return "limit";
      if (plan === "basic" && data.model_url) return "premium";
      await client.query("INSERT INTO products (id, restaurant_id, name, description, price, category, image_data, model_url, available) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [id, session.restaurantId, data.name, data.description, data.price, data.category, data.image_data || null, data.model_url || null, data.available]);
      return "ok";
    });
    if (result === "missing") return NextResponse.json({ error: "Local no encontrado" }, { status: 404 });
    if (result === "limit") return NextResponse.json({ error: "Alcanzaste el límite de productos de tu plan" }, { status: 409 });
    if (result === "premium") return NextResponse.json({ error: "Los modelos 3D/AR requieren Premium" }, { status: 403 });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) { return apiError(error); }
}
