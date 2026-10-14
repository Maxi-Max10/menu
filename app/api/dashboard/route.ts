import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { brandingSchema } from "@/lib/validation";
import { apiError, rejectCrossOrigin, unauthorized } from "@/lib/api";
import type { Product, Restaurant } from "@/lib/types";

export async function GET() {
  const session = await requireSession("restaurant");
  if (!session?.restaurantId) return unauthorized();
  try {
    const [restaurant, products, events, topProducts] = await Promise.all([
      query<Restaurant>("SELECT r.*, (r.paid_until IS NOT NULL AND NOT EXISTS (SELECT 1 FROM payments pay WHERE pay.restaurant_id = r.id)) AS is_trial FROM restaurants r WHERE r.id = $1", [session.restaurantId]),
      query<Product>("SELECT * FROM products WHERE restaurant_id = $1 ORDER BY category, created_at", [session.restaurantId]),
      query<{ kind: string; count: string }>("SELECT kind, COUNT(*)::text AS count FROM menu_events WHERE restaurant_id = $1 AND created_at >= now() - interval '30 days' GROUP BY kind", [session.restaurantId]),
      query<{ product_id: string; name: string; views: string }>("SELECT e.product_id, p.name, COUNT(*)::text AS views FROM menu_events e JOIN products p ON p.id = e.product_id WHERE e.restaurant_id = $1 AND e.kind = 'product_view' AND e.created_at >= now() - interval '30 days' GROUP BY e.product_id, p.name ORDER BY COUNT(*) DESC LIMIT 5", [session.restaurantId]),
    ]);
    if (!restaurant.rows[0]) return NextResponse.json({ error: "Local no encontrado" }, { status: 404 });
    return NextResponse.json({ restaurant: restaurant.rows[0], products: products.rows, metrics: { visits: Number(events.rows.find((row) => row.kind === "visit")?.count || 0), productViews: Number(events.rows.find((row) => row.kind === "product_view")?.count || 0), orderClicks: Number(events.rows.find((row) => row.kind === "order_click")?.count || 0), topProducts: topProducts.rows.map((row) => ({ ...row, views: Number(row.views) })) } });
  } catch (error) { return apiError(error); }
}

export async function PATCH(request: Request) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  const session = await requireSession("restaurant");
  if (!session?.restaurantId) return unauthorized();
  try {
    const data = brandingSchema.parse(await request.json());
    const restaurant = await query<Restaurant>("SELECT plan FROM restaurants WHERE id = $1", [session.restaurantId]);
    if (!restaurant.rows[0]) return NextResponse.json({ error: "Local no encontrado" }, { status: 404 });
    if (data.orders_enabled && restaurant.rows[0].plan !== "premium") return NextResponse.json({ error: "Los pedidos requieren Premium" }, { status: 403 });
    if (data.orders_enabled && !/^[1-9]\d{7,14}$/.test(data.whatsapp.replace(/\D/g, ""))) return NextResponse.json({ error: "Ingresá un WhatsApp con código de país (8 a 15 dígitos)" }, { status: 400 });
    await query(`UPDATE restaurants SET name=$1, type=$2, palette=$3, logo_data=$4, description=$5, address=$6, instagram=$7, whatsapp=$8, orders_enabled=$9 WHERE id=$10`,
      [data.name, data.type, data.palette, data.logo_data || null, data.description, data.address, data.instagram, data.whatsapp, restaurant.rows[0].plan === "premium" && data.orders_enabled, session.restaurantId]);
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
