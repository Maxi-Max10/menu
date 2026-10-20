import nodemailer from "nodemailer";
import QRCode from "qrcode";
import { formatMoney, PLANS, type Plan } from "@/lib/types";

const paymentHosts = new Set(["mpago.la", "link.mercadopago.com.ar"]);

export function validPaymentLink(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && paymentHosts.has(url.hostname) && url.pathname.length > 1 && !url.username && !url.password;
  } catch { return false; }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character);
}

export async function sendBillingNotice({ email, restaurantName, plan, paymentUrl, dueAt }: {
  email: string;
  restaurantName: string;
  plan: Plan;
  paymentUrl: string;
  dueAt: Date;
}) {
  if (!validPaymentLink(paymentUrl)) throw new Error("INVALID_PAYMENT_LINK");
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  if (!user || !password) throw new Error("SMTP_NOT_CONFIGURED");

  const formattedAmount = formatMoney(PLANS[plan].price);
  const dueDate = dueAt.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
  const name = escapeHtml(restaurantName);
  const url = escapeHtml(paymentUrl);
  const qr = await QRCode.toBuffer(paymentUrl, { type: "png", width: 300, margin: 2, errorCorrectionLevel: "M" });
  const transport = nodemailer.createTransport({
    host: "smtp.hostinger.com", port: 465, secure: true,
    auth: { user, pass: password },
    connectionTimeout: 8_000, greetingTimeout: 8_000, socketTimeout: 10_000,
  });

  await transport.sendMail({
    from: `Polo <${user}>`, to: email,
    subject: `Aviso de pago Polo · Plan ${PLANS[plan].label}`,
    text: `Hola, ${restaurantName}.\n\nTu plan ${PLANS[plan].label} venció el ${dueDate}. El precio del plan es ${formattedAmount}. Consultá el importe final en Mercado Pago antes de confirmar.\n\nPagá con Mercado Pago: ${paymentUrl}\n\nDespués de pagar, ingresá a tu panel de Polo y subí el comprobante en «Pago y comprobante». Revisaremos el pago antes de acreditar la cuota. Este aviso de pago no es una factura fiscal.\n\nGracias,\nPolo`,
    html: `<div style="background:#f5f6f1;padding:28px 12px;font-family:Arial,sans-serif;color:#263b33"><div style="max-width:560px;margin:auto;background:#fff;border-radius:12px;overflow:hidden"><div style="background:#244638;color:#fff;padding:24px 32px;font-size:26px;font-weight:bold">Polo</div><div style="padding:32px;text-align:center"><p style="font-size:12px;letter-spacing:2px;color:#66816e">AVISO DE PAGO</p><h1 style="font-size:26px;margin:16px 0;color:#244638">Hola, ${name}</h1><p>Tu plan <strong>${PLANS[plan].label}</strong> venció el ${dueDate}.</p><p style="font-size:30px;font-weight:bold;margin:22px 0">${formattedAmount}</p><p>Consultá el importe final en Mercado Pago antes de confirmar.</p><p>Escaneá el QR para pagar con Mercado Pago:</p><img src="cid:polo-payment-qr" width="220" height="220" alt="QR para abrir el enlace de pago en Mercado Pago" style="display:block;margin:18px auto" /><p><a href="${url}" style="display:inline-block;background:#244638;color:#fff;text-decoration:none;border-radius:7px;padding:14px 24px;font-weight:bold">Abrir enlace de pago</a></p><p style="font-size:13px;line-height:1.6;color:#68776d">Después de pagar, ingresá a tu panel de Polo y subí el comprobante en «Pago y comprobante». Revisaremos el pago antes de acreditar la cuota.</p></div><div style="background:#f0f2eb;padding:18px 32px;font-size:12px;color:#6b786e">Este es un aviso de pago, no una factura fiscal.</div></div></div>`,
    attachments: [{ filename: "polo-qr-pago.png", content: qr, contentType: "image/png", cid: "polo-payment-qr" }],
  });
}
