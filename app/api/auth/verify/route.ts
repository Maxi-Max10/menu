import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, readJsonLimited, rejectCrossOrigin } from "@/lib/api";
import { transaction } from "@/lib/db";
import { consumeRateLimit, requestIp } from "@/lib/rate-limit";
import { addCalendarMonth } from "@/lib/billing";

const schema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), password: z.string().min(1).max(128) });
const unusedPasswordHash = "$2a$12$cDbq4rx44UijHiFkvpDVReBSSN7zgPBInxMcW3.p3l9nkLyokNrYy";

export async function POST(request: Request) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  try {
    const { token, password } = schema.parse(await readJsonLimited(request));
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const limits = await Promise.all([
      consumeRateLimit("verify-ip", requestIp(request), 20, 60 * 60),
      consumeRateLimit("verify-token", tokenHash, 8, 24 * 60 * 60),
    ]);
    const blocked = limits.find((limit) => !limit.allowed);
    if (blocked) return NextResponse.json({ error: "Demasiados intentos. Probá más tarde." }, { status: 429, headers: { "Retry-After": String(blocked.retryAfter) } });
    const outcome = await transaction(async (client) => {
      const found = await client.query<{ user_id: string; restaurant_id: string; password_hash: string }>(`
        SELECT ev.user_id, u.restaurant_id, u.password_hash FROM email_verifications ev
        JOIN users u ON u.id = ev.user_id
        JOIN restaurants r ON r.id = u.restaurant_id
        WHERE ev.token_hash = $1 AND ev.expires_at > now() AND r.signup_status = 'pending'
        FOR UPDATE OF ev, r`, [tokenHash]);
      const record = found.rows[0];
      const validPassword = await bcrypt.compare(password, record?.password_hash || unusedPasswordHash);
      if (!record || !validPassword) return false;
      await client.query("UPDATE users SET email_verified_at = now() WHERE id = $1", [record.user_id]);
      await client.query("UPDATE restaurants SET signup_status = 'active', is_enabled = true, paid_until = $1 WHERE id = $2 AND signup_status = 'pending'", [addCalendarMonth(new Date()), record.restaurant_id]);
      await client.query("DELETE FROM email_verifications WHERE user_id = $1", [record.user_id]);
      return true;
    });
    if (!outcome) return NextResponse.json({ error: "El enlace venció o la contraseña no coincide" }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
