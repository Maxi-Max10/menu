import { createHmac, randomInt } from "node:crypto";
import { query } from "@/lib/db";

export function requestIp(request: Request) {
  const forwarded = request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export async function consumeRateLimit(scope: string, identifier: string, maxAttempts: number, windowSeconds: number) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET debe tener al menos 32 caracteres");
  const bucket = createHmac("sha256", secret).update(`${scope}:${identifier}`).digest("hex");
  const { rows } = await query<{ attempts: number; retry_after: number }>(`
    INSERT INTO auth_rate_limits (bucket_key, attempts, window_started_at) VALUES ($1, 1, now())
    ON CONFLICT (bucket_key) DO UPDATE SET
      attempts = CASE WHEN auth_rate_limits.window_started_at + ($2::int * interval '1 second') <= now()
        THEN 1 ELSE LEAST(auth_rate_limits.attempts + 1, $3::int + 1) END,
      window_started_at = CASE WHEN auth_rate_limits.window_started_at + ($2::int * interval '1 second') <= now()
        THEN now() ELSE auth_rate_limits.window_started_at END
    RETURNING attempts,
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM (window_started_at + ($2::int * interval '1 second') - now()))))::int AS retry_after
  `, [bucket, windowSeconds, maxAttempts]);
  if (randomInt(100) === 0) {
    await query("DELETE FROM auth_rate_limits WHERE window_started_at < now() - interval '2 days'").catch(console.error);
  }
  return { allowed: rows[0].attempts <= maxAttempts, retryAfter: rows[0].retry_after };
}
