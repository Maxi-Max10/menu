import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, readJsonLimited, rejectCrossOrigin, unauthorized } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";

const schema = z.object({ status: z.enum(["new", "preparing", "ready", "completed", "canceled"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  const session = await requireSession("restaurant");
  if (!session?.restaurantId) return unauthorized();
  try {
    const { id } = await params;
    z.string().uuid().parse(id);
    const { status } = schema.parse(await readJsonLimited(request));
    const result = await query("UPDATE orders SET status = $1 WHERE id = $2 AND restaurant_id = $3 AND EXISTS (SELECT 1 FROM restaurants WHERE id = $3 AND plan = 'premium') RETURNING id", [status, id, session.restaurantId]);
    if (!result.rowCount) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
