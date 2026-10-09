import "server-only";
import { prisma } from "@/lib/db";
import {
  isoDate,
  mapShiftsResponse,
  toDateWindow,
  type TooEasyShiftsResponse,
} from "@/lib/schedule/tooeasy-mapper";
import {
  SHIFTS_PATH,
  acquireToken,
  missingTooEasyConfig,
  readTooEasyConfig,
  type AcquiredToken,
  type TooEasyConfig,
} from "@/lib/schedule/tooeasy-client";
import { cacheAgeMs, cacheKey, readCache, writeCache } from "@/lib/schedule/cache";
import { recordError, recordSuccess } from "@/lib/schedule/status";
import type { DateRange, ScheduleProvider, ShiftEntry } from "@/lib/schedule/types";

/**
 * TooEasy WFM, built against the OpenAPI spec at {base}/swagger/v1/swagger.json
 * (read 2026-09-29, openapi 3.0.4, title "tooeasy.External.WebAPI", v1).
 *
 *   POST /api/RequestNewToken/AcquireToken   { userName, userPw } -> JWT
 *   GET  /api/Schedule/GetItemsForAction     startDate, numberOfDaysBack,
 *                                            storeId, employeeNo
 *
 * Read-only: one token POST plus GETs. Nothing here creates, updates or
 * deletes anything in TooEasy.
 *
 * Credentials come from the environment, are never logged, never included in
 * an error message, and never leave the server — this module is server-only
 * and reached solely through the provider factory.
 *
 * All payload mapping lives in tooeasy-mapper.ts so it can be tested against
 * fixtures instead of a live account.
 */

/** Renew this long before the token's own expiry. */
const RENEW_MARGIN_MS = 60_000;

type CachedToken = AcquiredToken;
let cachedToken: CachedToken | null = null;

/** Exported for tests and for the probe. */
export function resetTokenCache(): void {
  cachedToken = null;
}

async function getToken(config: TooEasyConfig, forceNew = false): Promise<string> {
  if (!forceNew && cachedToken && cachedToken.expiresAt - RENEW_MARGIN_MS > Date.now()) {
    return cachedToken.token;
  }
  cachedToken = await acquireToken(config);
  return cachedToken.token;
}

export class TooEasyApiScheduleProvider implements ScheduleProvider {
  readonly name = "TooEasy WFM API";

  async getShifts(
    userIds: string[],
    range: DateRange,
    options: { skipCache?: boolean } = {}
  ): Promise<ShiftEntry[]> {
    if (userIds.length === 0) return [];

    const missing = missingTooEasyConfig();
    if (missing.length > 0) {
      throw new Error(
        `TooEasy is not configured: ${missing.join(", ")} missing. ` +
          `Set SCHEDULE_PROVIDER=manual to use the CSV/ICS import instead.`
      );
    }
    const config = readTooEasyConfig();

    const key = cacheKey(userIds, range.from, range.to);
    if (!options.skipCache) {
      const cached = readCache(key);
      if (cached) return cached;
    }

    try {
      const entries = await this.fetchShifts(config, userIds, range);
      writeCache(key, entries);
      recordSuccess(entries.length);
      return entries;
    } catch (error) {
      recordError(error);
      throw error;
    }
  }

  private async fetchShifts(
    config: TooEasyConfig,
    userIds: string[],
    range: DateRange
  ): Promise<ShiftEntry[]> {
    // Only mapped people can be asked about; an unmapped user simply has no
    // counterpart in TooEasy.
    const users = await prisma.user.findMany({
      where: { id: { in: userIds }, tooEasyEmployeeId: { not: null } },
      select: { id: true, tooEasyEmployeeId: true },
    });
    if (users.length === 0) return [];

    const userByEmployeeId = new Map(
      users.map((user) => [user.tooEasyEmployeeId!.trim(), user.id])
    );

    const stores = await prisma.store.findMany({
      where: { tooEasyStoreNumber: { not: null } },
      select: { id: true, tooEasyStoreNumber: true },
    });
    const storeByNumber = new Map(
      stores.map((store) => [store.tooEasyStoreNumber!.trim(), store.id])
    );

    const window = toDateWindow(range.from, range.to);
    const entries: ShiftEntry[] = [];
    const unmappedStores = new Set<string>();

    for (const employeeNo of userByEmployeeId.keys()) {
      const url = new URL(`${config.baseUrl}${SHIFTS_PATH}`);
      url.searchParams.set("startDate", window.startDate);
      url.searchParams.set("numberOfDaysBack", String(window.numberOfDaysBack));
      url.searchParams.set("employeeNo", employeeNo);

      const payload = await this.getJson<TooEasyShiftsResponse>(config, url);
      const mapped = mapShiftsResponse(payload, { userByEmployeeId, storeByNumber });

      entries.push(...mapped.entries);
      mapped.unmappedStoreNumbers.forEach((number) => unmappedStores.add(number));
    }

    if (unmappedStores.size > 0) {
      console.warn(
        `TooEasy returned shifts for unmapped store number(s): ${[...unmappedStores].join(", ")}. ` +
          `Map them at /admin/tooeasy.`
      );
    }

    // Defensive: the range request is backwards-counting, so clip to what was
    // actually asked for rather than trusting the window arithmetic.
    const from = isoDate(range.from);
    const to = isoDate(range.to);
    return entries.filter((entry) => {
      const day = isoDate(entry.date);
      return day >= from && day <= to;
    });
  }

  /** GET with one retry on 401, re-acquiring the token first, then failing. */
  private async getJson<T>(config: TooEasyConfig, url: URL): Promise<T> {
    for (const attempt of [0, 1]) {
      const token = await getToken(config, attempt === 1);
      const response = await fetch(url, {
        headers: { authorization: `Bearer ${token}`, accept: "application/json" },
        cache: "no-store",
      });

      if (response.status === 401) {
        cachedToken = null;
        if (attempt === 0) continue;
        throw new Error("TooEasy rejected the token twice (401).");
      }
      if (!response.ok) {
        throw new Error(`TooEasy request failed (HTTP ${response.status}).`);
      }
      return (await response.json()) as T;
    }
    throw new Error("TooEasy request failed.");
  }
}

export { cacheAgeMs, cacheKey };

export {
  EMPLOYEES_PATH,
  SHIFTS_PATH,
  TOKEN_PATH,
  acquireToken,
  describeEnvironment,
  missingTooEasyConfig,
  readTooEasyConfig,
} from "@/lib/schedule/tooeasy-client";
export type { TooEasyConfig } from "@/lib/schedule/tooeasy-client";
