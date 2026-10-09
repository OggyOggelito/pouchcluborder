import "server-only";
import type { ShiftEntry } from "@/lib/schedule/types";

/**
 * Short server-side cache for shift fetches, so a dozen managers opening the
 * team grid at opening time do not each hit TooEasy.
 *
 * Process-local and intentionally simple. It holds no personal data beyond
 * what ShiftEntry already carries (ids, dates, times) and expires quickly.
 */
const TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 64;

type CacheRow = { entries: ShiftEntry[]; storedAt: number };

const cache = new Map<string, CacheRow>();

export function cacheKey(userIds: string[], from: Date, to: Date): string {
  return `${[...userIds].sort().join(",")}|${from.toISOString()}|${to.toISOString()}`;
}

export function readCache(key: string): ShiftEntry[] | null {
  const row = cache.get(key);
  if (!row) return null;

  if (Date.now() - row.storedAt > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return row.entries;
}

export function writeCache(key: string, entries: ShiftEntry[]): void {
  // Cheap bound: drop the oldest insertion when full.
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, { entries, storedAt: Date.now() });
}

/** Used by the "Uppdatera" button to force a live read. */
export function clearScheduleCache(): void {
  cache.clear();
}

export function cacheAgeMs(key: string): number | null {
  const row = cache.get(key);
  return row ? Date.now() - row.storedAt : null;
}

export const SCHEDULE_CACHE_TTL_MS = TTL_MS;
