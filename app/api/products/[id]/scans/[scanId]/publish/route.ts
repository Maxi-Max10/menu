import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { apiError, unauthorized } from "@/lib/api";
import { transaction } from "@/lib/db";

const UUID = z.string().uuid();

export async function POST(_request: Request, context: { params: Promise<{ id: string; scanId: string }> }) {
  const session = await requireSession("restaurant");
  if (!session?.restaurantId) return unauthorized();
  try {
    const params = await context.params;
    const productId = UUID.parse(params.id);
    const scanId = UUID.parse(params.scanId);
    const result = await transaction(async (client) => {
      const scan = await client.query<{ model_url: string; plan: string }>(
        `SELECT s.model_url, r.plan FROM model_scans s
         JOIN products p ON p.id = s.product_id
         JOIN restaurants r ON r.id = p.restaurant_id
         WHERE s.id = $1 AND s.product_id = $2 AND s.restaurant_id = $3 AND s.status = 'completed'
         FOR UPDATE OF p`, [scanId, productId, session.restaurantId]);
      if (!scan.rows[0]) return null;
      if (scan.rows[0].plan !== "premium") return "premium";
      await client.query("UPDATE products SET model_url = $1 WHERE id = $2 AND restaurant_id = $3",
        [scan.rows[0].model_url, productId, session.restaurantId]);
      return scan.rows[0].model_url;
    });
    if (!result) return NextResponse.json({ error: "Modelo terminado no encontrado" }, { status: 404 });
    if (result === "premium") return NextResponse.json({ error: "La captura 3D requiere Premium" }, { status: 403 });
    return NextResponse.json({ modelUrl: result });
  } catch (error) { return apiError(error); }
}
