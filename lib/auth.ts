import { cookies } from "next/headers";
import { createHmac, randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { query } from "@/lib/db";

export type Session = { role: "admin" | "restaurant"; restaurantId?: string; email: string; credentialTag?: string };
const COOKIE = "mesa_session";

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET debe tener al menos 32 caracteres");
  return new TextEncoder().encode(value);
}

// The tag changes with the stored password, invalidating sessions after a reset.
// Only this keyed digest is included in the cookie, never the bcrypt hash.
export function credentialTag(passwordHash: string) {
  return createHmac("sha256", secret()).update(passwordHash).digest("hex");
}

export async function createPasswordResetToken(user: { id: string; password_hash: string }) {
  return new SignJWT({ purpose: "password-reset", credentialTag: credentialTag(user.password_hash) })
    .setProtectedHeader({ alg: "HS256" }).setSubject(user.id).setIssuer("polo").setAudience("password-reset")
    .setJti(randomUUID()).setIssuedAt().setExpirationTime("30m").sign(secret());
}

export async function readPasswordResetToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"], issuer: "polo", audience: "password-reset" });
    if (payload.purpose === "password-reset" && typeof payload.sub === "string" && typeof payload.credentialTag === "string") {
      return { userId: payload.sub, credentialTag: payload.credentialTag };
    }
  } catch { /* Expired, malformed or incorrectly signed recovery link. */ }
  return null;
}

export async function createSession(session: Session) {
  const maxAge = session.role === "admin" ? 60 * 60 * 12 : 60 * 60 * 24 * 7;
  const token = await new SignJWT(session).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${maxAge}s`).sign(secret());
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if ((payload.role === "admin" || payload.role === "restaurant") && typeof payload.email === "string") {
      return { role: payload.role, email: payload.email, restaurantId: typeof payload.restaurantId === "string" ? payload.restaurantId : undefined, credentialTag: typeof payload.credentialTag === "string" ? payload.credentialTag : undefined };
    }
  } catch { /* Expired or invalid cookie. */ }
  return null;
}

export async function requireSession(role: Session["role"]) {
  const session = await getSession();
  if (session?.role !== role) return null;
  if (role === "restaurant") {
    if (!session.restaurantId) return null;
    const { rows } = await query<{ is_enabled: boolean; signup_status: string; password_hash: string }>(`
      SELECT r.is_enabled, r.signup_status, u.password_hash FROM restaurants r
      JOIN users u ON u.restaurant_id = r.id WHERE r.id = $1 AND u.email = $2
    `, [session.restaurantId, session.email]);
    const account = rows[0];
    if (!account?.is_enabled || account.signup_status !== "active" || session.credentialTag !== credentialTag(account.password_hash)) return null;
  }
  return session;
}
