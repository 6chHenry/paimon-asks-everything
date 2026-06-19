interface RateLimitInput {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
  bucket?: Map<string, number[]>;
}

declare global {
  var __paimonRateLimit: Map<string, number[]> | undefined;
}

function getBucket() {
  globalThis.__paimonRateLimit ??= new Map<string, number[]>();
  return globalThis.__paimonRateLimit;
}

export function checkRateLimit({
  key,
  limit,
  windowMs,
  now = Date.now(),
  bucket = getBucket(),
}: RateLimitInput) {
  const cutoff = now - windowMs;
  const recent = (bucket.get(key) ?? []).filter((timestamp) => timestamp > cutoff);
  if (recent.length >= limit) {
    bucket.set(key, recent);
    return {
      allowed: false,
      remaining: 0,
      resetAt: recent[0] + windowMs,
    };
  }
  const next = [...recent, now];
  bucket.set(key, next);
  return {
    allowed: true,
    remaining: Math.max(0, limit - next.length),
    resetAt: next[0] + windowMs,
  };
}

export function getRequestRateLimitKey(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}
