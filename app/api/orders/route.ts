import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, readJsonLimited, rejectCrossOrigin, unauthorized } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { query, transaction } from "@/lib/db";
import { consumeRateLimit, requestIp } from "@/lib/rate-limit";
import { priceOrder, type Order, type OrderItem } from "@/lib/types";
import { orderInputSchema } from "@/lib/validation";

type ProductPrice = { id: string; name: string; price: number; promo_price: number | null };
type StoredOrder = Omit<Order, "total" | "items"> & { total: string; items: (Omit<OrderItem, "line_total"> & { line_total: string })[] };

export async function POST(request: Request) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  try {
    const data = orderInputSchema.parse(await readJsonLimited(request, 20_000));
    const limit = await consumeRateLimit("orders-ip", requestIp(request), 40, 10 * 60);
    if (!limit.allowed) return NextResponse.json({ error: "Demasiados pedidos. Probá de nuevo más tarde." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });

    const orderId = randomUUID();
    await transaction(async (client) => {
      const restaurant = await client.query("SELECT id FROM restaurants WHERE id = $1 AND plan = 'premium' AND orders_enabled = true AND is_enabled = true AND paid_until >= now() FOR SHARE", [data.restaurantId]);
      if (!restaurant.rowCount) throw new Error("ORDERS_DISABLED");

      const ids = data.items.map((item) => item.productId);
      const products = await client.query<ProductPrice>("SELECT id, name, price, promo_price FROM products WHERE restaurant_id = $1 AND id = ANY($2::uuid[]) AND available = true FOR SHARE", [data.restaurantId, ids]);
      const { lines, total } = priceOrder(data.items, products.rows);
      await client.query(`INSERT INTO orders (id, restaurant_id, customer_name, customer_phone, delivery_method, delivery_address, payment_method, notes, total)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, [orderId, data.restaurantId, data.customerName, data.customerPhone, data.deliveryMethod || null,
        data.deliveryMethod === "delivery" ? data.deliveryAddress : null, data.paymentMethod || null, data.notes, total]);
      for (const line of lines) {
        await client.query("INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, line_total) VALUES ($1, $2, $3, $4, $5, $6)", [orderId, line.product.id, line.product.name, line.unitPrice, line.quantity, line.lineTotal]);
      }
    });
    return NextResponse.json({ id: orderId }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "ORDERS_DISABLED") return NextResponse.json({ error: "Este local no está recibiendo pedidos." }, { status: 409 });
    if (error instanceof Error && error.message === "PRODUCT_UNAVAILABLE") return NextResponse.json({ error: "La carta cambió. Actualizala y revisá tu pedido." }, { status: 409 });
    return apiError(error);
  }
}

export async function GET() {
  const session = await requireSession("restaurant");
  if (!session?.restaurantId) return unauthorized();
  try {
    const restaurant = await query<{ plan: string }>("SELECT plan FROM restaurants WHERE id = $1", [session.restaurantId]);
    if (restaurant.rows[0]?.plan !== "premium") return NextResponse.json({ error: "Los pedidos requieren Premium" }, { status: 403 });
    const { rows } = await query<StoredOrder>(`
      SELECT o.id, o.restaurant_id, o.customer_name, o.customer_phone, o.delivery_method, o.delivery_address, o.payment_method,
        o.notes, o.total::text AS total, o.status, o.created_at,
        COALESCE((SELECT json_agg(json_build_object('product_id', oi.product_id, 'product_name', oi.product_name,
          'unit_price', oi.unit_price, 'quantity', oi.quantity, 'line_total', oi.line_total::text) ORDER BY oi.id)
          FROM order_items oi WHERE oi.order_id = o.id), '[]'::json) AS items
      FROM orders o WHERE o.restaurant_id = $1 AND o.status <> 'completed'
      ORDER BY o.created_at DESC
    `, [session.restaurantId]);
    return NextResponse.json({ orders: rows.map((order) => ({ ...order, total: Number(order.total), items: order.items.map((item) => ({ ...item, line_total: Number(item.line_total) })) })) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
