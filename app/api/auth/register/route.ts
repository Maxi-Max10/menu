import { createHash, randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, readJsonLimited, rejectCrossOrigin } from "@/lib/api";
import { query, transaction } from "@/lib/db";
import { consumeRateLimit, requestIp } from "@/lib/rate-limit";
import { passwordSchema, phoneSchema } from "@/lib/validation";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  type: z.enum(["Restaurante", "Cafetería", "Bar", "Otro"]),
  plan: z.enum(["basic", "premium"]),
  email: z.string().trim().email().max(254),
  phone: phoneSchema,
  password: passwordSchema,
});

function slugify(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48).replace(/-$/, "") || "local";
}

function publicOrigin() {
  const url = new URL(process.env.NEXT_PUBLIC_SITE_URL || "");
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.hostname === "localhost")) throw new Error("NEXT_PUBLIC_SITE_URL debe ser HTTPS");
  return url.origin;
}

async function sendVerification(email: string, token: string) {
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  if (!user || !password) return false;
  const link = `${publicOrigin()}/verificar?token=${encodeURIComponent(token)}`;
  const transport = nodemailer.createTransport({
    host: "smtp.hostinger.com",
    port: 465,
    secure: true,
    auth: { user, pass: password },
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 10_000,
  });
  await transport.sendMail({
    from: `Polo <${user}>`,
    to: email,
    subject: "Confirmá tu correo para activar Polo",
    text: `Abrí este enlace para confirmar tu correo y activar el mes gratis de Polo: ${link}\n\nPara activarlo necesitarás la contraseña que elegiste al registrarte. El enlace vence en 24 horas. Si no creaste esta cuenta, ignorá este mensaje.`,
  });
  return true;
}

export async function POST(request: Request) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  try {
    const data = schema.parse(await readJsonLimited(request));
    const email = data.email.toLowerCase();
    const limits = await Promise.all([
      consumeRateLimit("register-ip", requestIp(request), 5, 60 * 60),
      consumeRateLimit("register-email", email, 3, 24 * 60 * 60),
    ]);
    const blocked = limits.find((limit) => !limit.allowed);
    if (blocked) return NextResponse.json({ error: "Demasiados intentos. Probá de nuevo más tarde." }, { status: 429, headers: { "Retry-After": String(blocked.retryAfter) } });
    const response = { message: "Si el correo es nuevo, tu solicitud se registró. Revisá tu correo para activarla o aguardá la aprobación de Polo." };
    if (email === process.env.ADMIN_EMAIL?.toLowerCase().trim()) return NextResponse.json(response, { status: 202 });
    const passwordHash = await bcrypt.hash(data.password, 12);
    const existing = await query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rowCount) return NextResponse.json(response, { status: 202 });

    const restaurantId = randomUUID();
    const userId = randomUUID();
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const slug = `${slugify(data.name)}-${randomBytes(4).toString("hex")}`;
    await transaction(async (client) => {
      await client.query("INSERT INTO restaurants (id, name, slug, type, plan, is_enabled, signup_status) VALUES ($1, $2, $3, $4, $5, false, 'pending')", [restaurantId, data.name, slug, data.type, data.plan]);
      await client.query("INSERT INTO users (id, restaurant_id, email, phone, password_hash) VALUES ($1, $2, $3, $4, $5)", [userId, restaurantId, email, data.phone, passwordHash]);
      await client.query("INSERT INTO email_verifications (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '24 hours')", [userId, tokenHash]);
    });
    try { await sendVerification(email, token); }
    catch (error) { console.error(error); }
    return NextResponse.json(response, { status: 202 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") return NextResponse.json({ message: "Si el correo es nuevo, tu solicitud se registró. Revisá tu correo para activarla o aguardá la aprobación de Polo." }, { status: 202 });
    return apiError(error);
  }
}
