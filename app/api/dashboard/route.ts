import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { brandingSchema } from "@/lib/validation";
import { apiError, unauthorized } from "@/lib/api";
import type { Product, Restaurant } from "@/lib/types";

export async function GET() {
  const session = await requireSession("restaurant");
  if (!session?.restaurantId) return unauthorized();
  try {
    const [restaurant, products] = await Promise.all([
      query<Restaurant>("SELECT * FROM restaurants WHERE id = $1", [session.restaurantId]),
      query<Product>("SELECT * FROM products WHERE restaurant_id = $1 ORDER BY category, created_at", [session.restaurantId]),
    ]);
    if (!restaurant.rows[0]) return NextResponse.json({ error: "Local no encontrado" }, { status: 404 });
    return NextResponse.json({ restaurant: restaurant.rows[0], products: products.rows });
  } catch (error) { return apiError(error); }
}

export async function PATCH(request: Request) {
  const session = await requireSession("restaurant");
  if (!session?.restaurantId) return unauthorized();
  try {
    const data = brandingSchema.parse(await request.json());
    await query(`UPDATE restaurants SET name=$1, type=$2, palette=$3, logo_data=$4, description=$5, address=$6, instagram=$7, whatsapp=$8 WHERE id=$9`,
      [data.name, data.type, data.palette, data.logo_data || null, data.description, data.address, data.instagram, data.whatsapp, session.restaurantId]);
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
