import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { productSchema } from "@/lib/validation";
import { apiError, rejectCrossOrigin, unauthorized } from "@/lib/api";
import type { Restaurant } from "@/lib/types";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  const session = await requireSession("restaurant");
  if (!session?.restaurantId) return unauthorized();
  try {
    const { id } = await context.params;
    const data = productSchema.parse(await request.json());
    const restaurant = await query<Restaurant>("SELECT plan FROM restaurants WHERE id = $1", [session.restaurantId]);
    if (data.promo_price !== null && data.promo_price >= data.price) return NextResponse.json({ error: "El precio promocional debe ser menor al precio normal" }, { status: 400 });
    if (restaurant.rows[0]?.plan === "basic" && (data.featured || data.promo_price !== null)) return NextResponse.json({ error: "Los destacados y promociones requieren Premium" }, { status: 403 });
    const result = await query(`UPDATE products SET name=$1, description=$2, price=$3, category=$4, image_data=$5, available=$6, featured=$7, promo_price=$8 WHERE id=$9 AND restaurant_id=$10`,
      [data.name, data.description, data.price, data.category, data.image_data || null, data.available, data.featured, data.promo_price, id, session.restaurantId]);
    if (!result.rowCount) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  const session = await requireSession("restaurant");
  if (!session?.restaurantId) return unauthorized();
  try {
    const { id } = await context.params;
    const result = await query("DELETE FROM products WHERE id = $1 AND restaurant_id = $2", [id, session.restaurantId]);
    if (!result.rowCount) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
