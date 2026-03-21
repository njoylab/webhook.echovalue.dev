import type { Context, Next } from "hono";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 30;

const store = new Map<string, RateLimitEntry>();

// Periodically clean expired entries
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}, WINDOW_MS * 2);

export function stopRateLimitCleanup(): void {
  clearInterval(cleanupInterval);
}

function getClientIp(c: Context): string {
  return (
    (c.req.header("x-forwarded-for") || "").split(",")[0].trim() ||
    c.req.header("x-real-ip") ||
    "unknown"
  );
}

export function rateLimit() {
  return async (c: Context, next: Next) => {
    const ip = getClientIp(c);
    const now = Date.now();

    let entry = store.get(ip);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + WINDOW_MS };
      store.set(ip, entry);
    }

    entry.count++;

    if (entry.count > MAX_REQUESTS) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      c.header("Retry-After", String(retryAfter));
      return c.json({ error: "Too many requests. Try again later." }, 429);
    }

    await next();
  };
}
