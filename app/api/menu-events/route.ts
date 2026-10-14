import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { apiError, rejectCrossOrigin } from "@/lib/api";

const eventSchema = z.object({
  restaurantId: z.string().uuid(),
  kind: z.enum(["visit", "product_view", "order_click"]),
  productId: z.string().uuid().nullable().optional(),
});

export async function POST(request: Request) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  try {
    const event = eventSchema.parse(await request.json());
    if ((event.kind === "product_view") !== !!event.productId) return NextResponse.json({ error: "Producto inválido" }, { status: 400 });
    const result = await query(`
      INSERT INTO menu_events (restaurant_id, product_id, kind)
      SELECT r.id, p.id, $2
      FROM restaurants r
      LEFT JOIN products p ON p.id = $3 AND p.restaurant_id = r.id AND p.available = true
      WHERE r.id = $1 AND r.plan = 'premium' AND r.is_enabled = true AND r.paid_until >= now()
        AND ($2 <> 'product_view' OR p.id IS NOT NULL)
        AND ($2 <> 'order_click' OR (r.orders_enabled = true AND regexp_replace(r.whatsapp, '[^0-9]', '', 'g') <> ''))
    `, [event.restaurantId, event.kind, event.productId || null]);
    if (!result.rowCount) return NextResponse.json({ error: "Evento no disponible" }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch (error) { return apiError(error); }
}
