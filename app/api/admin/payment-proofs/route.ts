import { NextResponse } from "next/server";
import { apiError, unauthorized } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET() {
  if (!(await requireSession("admin"))) return unauthorized();
  try {
    const { rows } = await query(`SELECT pp.id, pp.restaurant_id, r.name AS restaurant_name,
      u.email AS owner_email, pp.period_due_at, pp.plan, pp.filename, pp.mime_type, pp.status, pp.submitted_at,
      (r.paid_until = pp.period_due_at) AS current_period
      FROM payment_proofs pp JOIN restaurants r ON r.id = pp.restaurant_id
      LEFT JOIN LATERAL (SELECT email FROM users WHERE restaurant_id = r.id ORDER BY created_at LIMIT 1) u ON true
      ORDER BY CASE WHEN pp.status = 'pending' THEN 0 ELSE 1 END, pp.submitted_at DESC LIMIT 100`);
    return NextResponse.json({ proofs: rows }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
