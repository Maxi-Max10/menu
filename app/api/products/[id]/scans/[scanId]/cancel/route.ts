import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { apiError, unauthorized } from "@/lib/api";
import { query } from "@/lib/db";

const UUID = z.string().uuid();

export async function DELETE(_request: Request, context: { params: Promise<{ id: string; scanId: string }> }) {
  const session = await requireSession("restaurant");
  if (!session?.restaurantId) return unauthorized();
  try {
    const { id, scanId } = await context.params;
    const result = await query(
      `UPDATE model_scans SET status = 'failed', error = 'No se pudieron cargar las fotos.', updated_at = now()
       WHERE id = $1 AND product_id = $2 AND restaurant_id = $3 AND status = 'awaiting_upload'`,
      [UUID.parse(scanId), UUID.parse(id), session.restaurantId]);
    return NextResponse.json({ cancelled: !!result.rowCount });
  } catch (error) { return apiError(error); }
}
