import nodemailer from "nodemailer";

export async function sendPasswordRecovery(email: string, token: string) {
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  if (!user || !password) throw new Error("SMTP_NOT_CONFIGURED");
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  const site = new URL(configuredOrigin);
  if (site.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && site.hostname === "localhost" && site.protocol === "http:")) throw new Error("INVALID_SITE_ORIGIN");
  const link = `${site.origin}/recuperar?token=${encodeURIComponent(token)}`;
  const transport = nodemailer.createTransport({
    host: "smtp.hostinger.com", port: 465, secure: true,
    auth: { user, pass: password },
    connectionTimeout: 8_000, greetingTimeout: 8_000, socketTimeout: 10_000,
  });
  await transport.sendMail({
    from: `Polo <${user}>`, to: email,
    subject: "Recuperá el acceso a tu cuenta de Polo",
    text: `Recibimos una solicitud para cambiar la contraseña de tu cuenta de local en Polo.\n\nAbrí este enlace para elegir una contraseña nueva: ${link}\n\nEl enlace vence en 30 minutos y deja de servir después de cambiar la contraseña.\n\nSi no pediste este cambio, ignorá este correo. Tu contraseña seguirá siendo la misma.`,
  });
}
