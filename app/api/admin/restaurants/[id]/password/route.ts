import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, readJsonLimited, rejectCrossOrigin, unauthorized } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { passwordSchema } from "@/lib/validation";

const schema = z.object({ password: passwordSchema });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  if (!(await requireSession("admin"))) return unauthorized();
  try {
    const id = z.string().uuid().parse((await context.params).id);
    const { password } = schema.parse(await readJsonLimited(request));
    const hash = await bcrypt.hash(password, 12);
    const result = await query("UPDATE users SET password_hash = $1 WHERE restaurant_id = $2 RETURNING id", [hash, id]);
    if (!result.rowCount) return NextResponse.json({ error: "No se encontró la cuenta del local" }, { status: 404 });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
