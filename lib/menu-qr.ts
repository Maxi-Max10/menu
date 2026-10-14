export function publicMenuUrl(slug: string, currentOrigin: string): string {
  const site = new URL(process.env.NEXT_PUBLIC_SITE_URL || currentOrigin);
  if (site.protocol !== "https:" && site.protocol !== "http:") {
    throw new Error("La dirección del sitio debe usar HTTP o HTTPS.");
  }
  return new URL(`/menu/${encodeURIComponent(slug)}`, site.origin).href;
}

export async function generateMenuQr(url: string) {
  const { default: QRCode } = await import("qrcode");
  const options = {
    errorCorrectionLevel: "M" as const,
    margin: 4,
    width: 1200,
    color: { dark: "#000000", light: "#ffffff" },
  };
  const [png, svg] = await Promise.all([
    QRCode.toDataURL(url, options),
    QRCode.toString(url, { ...options, type: "svg" }),
  ]);
  return { png, svg };
}
