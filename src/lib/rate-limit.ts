/**
 * A small fixed-window rate limiter for sign-in attempts.
 *
 * Process-local and in memory on purpose. There is no Redis in this app and
 * one SQLite file behind one Node process, so a shared store would be a new
 * dependency to protect a login that sees a few dozen attempts a day. What it
 * buys is the thing that actually matters: an automated password guess against
 * a known email address stops being free.
 *
 * What it does NOT do, and what the README says it does not do: survive a
 * restart, or span several instances. Behind more than one process it limits
 * per process. If this app is ever scaled out, this is the first thing to move
 * into a shared store.
 *
 * Pure except for the clock, so the windows can be tested without waiting.
 */

export type RateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterMs: number };

export type RateLimitRule = {
  /** How many attempts are allowed inside one window. */
  limit: number;
  windowMs: number;
};

/** Sign-in: slow enough to stop a script, loose enough for a bad morning. */
export const SIGN_IN_RULE: RateLimitRule = { limit: 10, windowMs: 15 * 60 * 1000 };

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Cheap bound. The map holds one small row per key per window. */
const MAX_KEYS = 5_000;

export function consume(
  key: string,
  rule: RateLimitRule = SIGN_IN_RULE,
  now: number = Date.now()
): RateLimitResult {
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    if (buckets.size >= MAX_KEYS) pruneExpired(now);
    buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
    return { allowed: true, remaining: rule.limit - 1 };
  }

  if (existing.count >= rule.limit) {
    return { allowed: false, retryAfterMs: existing.resetAt - now };
  }

  existing.count += 1;
  return { allowed: true, remaining: rule.limit - existing.count };
}

/**
 * Forget a key — called after a successful sign-in, so one person typing their
 * password wrong a few times before getting it right starts fresh.
 */
export function reset(key: string): void {
  buckets.delete(key);
}

function pruneExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  // Still full of live windows: drop the oldest rather than grow without end.
  if (buckets.size >= MAX_KEYS) {
    const oldest = buckets.keys().next();
    if (!oldest.done) buckets.delete(oldest.value);
  }
}

/** Only for tests — the limiter is otherwise a module-level singleton. */
export function clearAll(): void {
  buckets.clear();
}

/** "om 3 minuter" / "om 20 sekunder", for the one message a blocked user sees. */
export function describeRetry(retryAfterMs: number): string {
  const minutes = Math.ceil(retryAfterMs / 60_000);
  if (minutes <= 1) return "om en minut";
  return `om ${minutes} minuter`;
}
