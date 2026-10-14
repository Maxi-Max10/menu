import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { productSchema } from "@/lib/validation";
import { apiError, unauthorized } from "@/lib/api";
import type { Restaurant } from "@/lib/types";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireSession("restaurant");
  if (!session?.restaurantId) return unauthorized();
  try {
    const { id } = await context.params;
    const data = productSchema.parse(await request.json());
    const restaurant = await query<Restaurant>("SELECT plan FROM restaurants WHERE id = $1", [session.restaurantId]);
    if (restaurant.rows[0]?.plan === "basic" && data.model_url) return NextResponse.json({ error: "Los modelos 3D/AR requieren Premium" }, { status: 403 });
    const result = await query(`UPDATE products SET name=$1, description=$2, price=$3, category=$4, image_data=$5, model_url=$6, available=$7 WHERE id=$8 AND restaurant_id=$9`,
      [data.name, data.description, data.price, data.category, data.image_data || null, data.model_url || null, data.available, id, session.restaurantId]);
    if (!result.rowCount) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireSession("restaurant");
  if (!session?.restaurantId) return unauthorized();
  try {
    const { id } = await context.params;
    const result = await query("DELETE FROM products WHERE id = $1 AND restaurant_id = $2", [id, session.restaurantId]);
    if (!result.rowCount) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
