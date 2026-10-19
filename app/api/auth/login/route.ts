import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createHash, timingSafeEqual } from "node:crypto";
import { createSession, credentialTag } from "@/lib/auth";
import { query } from "@/lib/db";
import { apiError, readJsonLimited, rejectCrossOrigin } from "@/lib/api";
import { consumeRateLimit, requestIp } from "@/lib/rate-limit";
import { z } from "zod";

const loginSchema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(128) });
const unusedPasswordHash = "$2a$12$cDbq4rx44UijHiFkvpDVReBSSN7zgPBInxMcW3.p3l9nkLyokNrYy";

function equalSecret(left: string, right: string) {
  return timingSafeEqual(createHash("sha256").update(left).digest(), createHash("sha256").update(right).digest());
}

export async function POST(request: Request) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  try {
    const { email, password } = loginSchema.parse(await readJsonLimited(request));
    const normalized = email.toLowerCase().trim();
    const limits = await Promise.all([
      consumeRateLimit("login-ip", requestIp(request), 30, 15 * 60),
      consumeRateLimit("login-email", normalized, 8, 15 * 60),
    ]);
    const blocked = limits.find((limit) => !limit.allowed);
    if (blocked) return NextResponse.json({ error: "Demasiados intentos. Probá de nuevo más tarde." }, { status: 429, headers: { "Retry-After": String(blocked.retryAfter) } });
    if (normalized === process.env.ADMIN_EMAIL?.toLowerCase().trim() && process.env.ADMIN_PASSWORD && equalSecret(password, process.env.ADMIN_PASSWORD)) {
      await createSession({ role: "admin", email: normalized });
      return NextResponse.json({ role: "admin" });
    }
    const { rows } = await query<{ id: string; restaurant_id: string; email: string; password_hash: string; signup_status: string; is_enabled: boolean }>("SELECT u.*, r.signup_status, r.is_enabled FROM users u JOIN restaurants r ON r.id = u.restaurant_id WHERE u.email = $1", [normalized]);
    const user = rows[0];
    const validPassword = await bcrypt.compare(password, user?.password_hash || unusedPasswordHash);
    if (!user || !validPassword) return NextResponse.json({ error: "Correo o contraseña incorrectos" }, { status: 401 });
    if (user.signup_status !== "active") return NextResponse.json({ error: "La cuenta todavía está pendiente de activación" }, { status: 403 });
    if (!user.is_enabled) return NextResponse.json({ error: "La cuenta está pausada. Contactá a Polo." }, { status: 403 });
    await createSession({ role: "restaurant", restaurantId: user.restaurant_id, email: user.email, credentialTag: credentialTag(user.password_hash) });
    return NextResponse.json({ role: "restaurant" });
  } catch (error) { return apiError(error); }
}
