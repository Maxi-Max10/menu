import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, readJsonLimited, rejectCrossOrigin } from "@/lib/api";
import { credentialTag, readPasswordResetToken } from "@/lib/auth";
import { query } from "@/lib/db";
import { consumeRateLimit, requestIp } from "@/lib/rate-limit";
import { passwordSchema } from "@/lib/validation";

const schema = z.object({ token: z.string().min(1).max(2048), password: passwordSchema });
const invalidLink = () => NextResponse.json({ error: "El enlace venció, ya se usó o no es válido. Solicitá uno nuevo." }, { status: 400, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  try {
    const { token, password } = schema.parse(await readJsonLimited(request));
    const limits = await Promise.all([
      consumeRateLimit("password-reset-ip", requestIp(request), 20, 60 * 60),
      consumeRateLimit("password-reset-token", token, 10, 30 * 60),
    ]);
    const blocked = limits.find((limit) => !limit.allowed);
    if (blocked) return NextResponse.json({ error: "Demasiados intentos. Probá de nuevo más tarde." }, { status: 429, headers: { "Retry-After": String(blocked.retryAfter) } });
    const claims = await readPasswordResetToken(token);
    if (!claims || !z.string().uuid().safeParse(claims.userId).success) return invalidLink();
    const { rows } = await query<{ id: string; password_hash: string }>("SELECT id, password_hash FROM users WHERE id = $1", [claims.userId]);
    const account = rows[0];
    if (!account || claims.credentialTag !== credentialTag(account.password_hash)) return invalidLink();
    const previousHash = account.password_hash;
    const hash = await bcrypt.hash(password, 12);
    // Compare-and-set makes a recovery link single-use even if two requests race.
    const updated = await query("UPDATE users SET password_hash = $1 WHERE id = $2 AND password_hash = $3 RETURNING id", [hash, account.id, previousHash]);
    if (!updated.rowCount) return invalidLink();
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
