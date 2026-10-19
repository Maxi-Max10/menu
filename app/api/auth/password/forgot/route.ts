import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, readJsonLimited, rejectCrossOrigin } from "@/lib/api";
import { createPasswordResetToken } from "@/lib/auth";
import { query } from "@/lib/db";
import { sendPasswordRecovery } from "@/lib/password-recovery-mail";
import { consumeRateLimit, requestIp } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().trim().email().max(254) });
const message = "Si el correo pertenece a una cuenta de local, recibirás un enlace para crear una contraseña nueva. Revisá también la carpeta de spam. Si no llega, contactá a Polo.";

export async function POST(request: Request) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  try {
    const data = schema.parse(await readJsonLimited(request));
    const email = data.email.toLowerCase();
    const limits = await Promise.all([
      consumeRateLimit("password-forgot-ip", requestIp(request), 10, 60 * 60),
      consumeRateLimit("password-forgot-email", email, 3, 60 * 60),
    ]);
    const blocked = limits.find((limit) => !limit.allowed);
    if (blocked) return NextResponse.json({ error: "Demasiadas solicitudes. Probá de nuevo más tarde." }, { status: 429, headers: { "Retry-After": String(blocked.retryAfter) } });
    // Admin credentials are managed separately through the deployment settings.
    if (email !== process.env.ADMIN_EMAIL?.toLowerCase().trim()) {
      const { rows } = await query<{ id: string; email: string; password_hash: string }>("SELECT id, email, password_hash FROM users WHERE email = $1", [email]);
      const account = rows[0];
      if (account) {
        try { await sendPasswordRecovery(account.email, await createPasswordResetToken(account)); }
        catch {
          // Do not expose email existence, SMTP details or a reset token.
          console.error("No se pudo enviar un correo de recuperación de contraseña.");
        }
      }
    }
    return NextResponse.json({ message }, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
