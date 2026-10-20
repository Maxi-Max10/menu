import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, readJsonLimited, rejectCrossOrigin, unauthorized } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { validPaymentLink } from "@/lib/billing-notice";
import { query } from "@/lib/db";

const linksSchema = z.object({
  basic: z.string().trim().max(500).refine((value) => !value || validPaymentLink(value), "Enlace de Mercado Pago inválido para Esencial"),
  premium: z.string().trim().max(500).refine((value) => !value || validPaymentLink(value), "Enlace de Mercado Pago inválido para Premium"),
});

export async function GET() {
  if (!(await requireSession("admin"))) return unauthorized();
  try {
    const { rows } = await query<{ basic_url: string; premium_url: string }>("SELECT basic_url, premium_url FROM billing_settings WHERE id = true");
    return NextResponse.json({ basic: rows[0]?.basic_url || "", premium: rows[0]?.premium_url || "" }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}

export async function PATCH(request: Request) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  if (!(await requireSession("admin"))) return unauthorized();
  try {
    const links = linksSchema.parse(await readJsonLimited(request));
    await query(`INSERT INTO billing_settings (id, basic_url, premium_url) VALUES (true, $1, $2)
      ON CONFLICT (id) DO UPDATE SET basic_url = EXCLUDED.basic_url, premium_url = EXCLUDED.premium_url`, [links.basic, links.premium]);
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
