import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

export type Session = { role: "admin" | "restaurant"; restaurantId?: string; email: string };
const COOKIE = "mesa_session";

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET debe tener al menos 32 caracteres");
  return new TextEncoder().encode(value);
}

export async function createSession(session: Session) {
  const token = await new SignJWT(session).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d").sign(secret());
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
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
      return { role: payload.role, email: payload.email, restaurantId: typeof payload.restaurantId === "string" ? payload.restaurantId : undefined };
    }
  } catch { /* Expired or invalid cookie. */ }
  return null;
}

export async function requireSession(role: Session["role"]) {
  const session = await getSession();
  return session?.role === role ? session : null;
}
