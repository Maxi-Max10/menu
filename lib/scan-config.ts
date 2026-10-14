export function scanConfig() {
  const url = process.env.SCAN_WORKER_URL?.replace(/\/$/, "");
  const secret = process.env.SCAN_WORKER_SECRET;
  if (!url || !secret || secret.length < 32) return null;
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && parsed.hostname === "localhost")) return null;
  return { url: parsed.origin, secret };
}
