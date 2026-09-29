import { prisma } from "@/lib/db";
import type { DateRange, ScheduleProvider, ShiftEntry } from "@/lib/schedule/types";

/**
 * TooEasy WFM, built against the OpenAPI spec at
 * {base}/swagger/v1/swagger.json (read 2026-09-29, openapi 3.0.4,
 * title "tooeasy.External.WebAPI", version v1).
 *
 * Auth: HTTP bearer, JWT. A token comes from
 *   POST /api/RequestNewToken/AcquireToken   body { userName, userPw }
 * Credentials come from the environment and are never logged or sent to the
 * client — this module is server-only, imported solely by the provider factory.
 *
 * Shifts: GET /api/Schedule/GetItemsForAction
 *   query: startDate, numberOfDaysBack, storeId, employeeNo
 * The response nests
 *   stores[] (Butik: StoreNumber, StoreName)
 *     -> employees[] (Anstalld: EmployeeId, Firstname, Lastname)
 *        -> days[] (Dag: Date)
 *           -> actions[] (Pass: StartTime, EndTime, ...)
 *
 * `Pass` also carries TotalCost, OBCost, PayrollTaxes and CostExPayrollTax.
 * Those are payroll figures and are deliberately dropped here rather than
 * carried into ShiftEntry, so cost data cannot leak into a schedule grid that
 * every store manager can open.
 */

const TOKEN_PATH = "/api/RequestNewToken/AcquireToken";
const SHIFTS_PATH = "/api/Schedule/GetItemsForAction";

/** Refresh a little before the hour, so a long request cannot straddle expiry. */
const TOKEN_TTL_MS = 50 * 60 * 1000;

type CachedToken = { token: string; expiresAt: number };
let cachedToken: CachedToken | null = null;

export class TooEasyApiScheduleProvider implements ScheduleProvider {
  readonly name = "TooEasy WFM API";

  private readonly baseUrl: string;
  private readonly userName: string;
  private readonly password: string;

  constructor() {
    this.baseUrl = (process.env.TOOEASY_BASE_URL ?? "").replace(/\/$/, "");
    this.userName = process.env.TOOEASY_USERNAME ?? "";
    this.password = process.env.TOOEASY_PASSWORD ?? "";
  }

  private assertConfigured() {
    const missing = [
      !this.baseUrl && "TOOEASY_BASE_URL",
      !this.userName && "TOOEASY_USERNAME",
      !this.password && "TOOEASY_PASSWORD",
    ].filter(Boolean);

    if (missing.length > 0) {
      throw new Error(
        `TooEasy is not configured: ${missing.join(", ")} missing. ` +
          `Set SCHEDULE_PROVIDER=manual to use the CSV/ICS import instead.`
      );
    }
  }

  private async getToken(): Promise<string> {
    if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;

    const response = await fetch(`${this.baseUrl}${TOKEN_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ userName: this.userName, userPw: this.password }),
      cache: "no-store",
    });

    if (!response.ok) {
      // Deliberately does not echo the body: a failed auth response can repeat
      // back what was sent.
      throw new Error(`TooEasy token request failed (HTTP ${response.status}).`);
    }

    const token = extractToken(await response.text());
    if (!token) {
      throw new Error(
        "TooEasy returned no recognisable token. The spec documents this response only " +
          "as `200 OK` with no schema, so the field name is a guess — see the README."
      );
    }

    cachedToken = { token, expiresAt: Date.now() + TOKEN_TTL_MS };
    return token;
  }

  async getShifts(userIds: string[], range: DateRange): Promise<ShiftEntry[]> {
    if (userIds.length === 0) return [];
    this.assertConfigured();

    // Only people who have actually been mapped can be asked about.
    const users = await prisma.user.findMany({
      where: { id: { in: userIds }, tooEasyEmployeeId: { not: null } },
      select: { id: true, tooEasyEmployeeId: true },
    });
    if (users.length === 0) return [];

    const ourUserByEmployeeId = new Map(
      users.map((user) => [user.tooEasyEmployeeId!.trim(), user.id])
    );

    const stores = await prisma.store.findMany({
      where: { tooEasyStoreNumber: { not: null } },
      select: { id: true, tooEasyStoreNumber: true },
    });
    const ourStoreByNumber = new Map(
      stores.map((store) => [store.tooEasyStoreNumber!.trim(), store.id])
    );

    const token = await this.getToken();

    // The endpoint takes `startDate` plus `numberOfDaysBack`, i.e. it looks
    // backwards from a date. To cover a forward range we anchor on its end and
    // reach back across it.
    //
    // ASSUMPTION, unverified against a live account: that the window is
    // inclusive of both ends. Confirm against real data before trusting the
    // edges — see the README.
    const days = Math.max(
      1,
      Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000) + 1
    );

    const entries: ShiftEntry[] = [];
    const seenUnmappedStores = new Set<string>();

    // One request per employee: the endpoint's employeeNo is singular, and
    // fetching whole stores would pull back colleagues we were not asked about.
    for (const [employeeNo, ourUserId] of ourUserByEmployeeId) {
      const url = new URL(`${this.baseUrl}${SHIFTS_PATH}`);
      url.searchParams.set("startDate", isoDate(range.to));
      url.searchParams.set("numberOfDaysBack", String(days));
      url.searchParams.set("employeeNo", employeeNo);

      const response = await fetch(url, {
        headers: { authorization: `Bearer ${token}`, accept: "application/json" },
        cache: "no-store",
      });

      if (response.status === 401) {
        cachedToken = null;
        throw new Error("TooEasy rejected the token (401).");
      }
      if (!response.ok) {
        throw new Error(`TooEasy shift request failed (HTTP ${response.status}).`);
      }

      const payload = (await response.json()) as TooEasyShiftsResponse;

      for (const store of payload?.stores ?? []) {
        const storeNumber = (store.StoreNumber ?? "").trim();
        const ourStoreId = ourStoreByNumber.get(storeNumber);

        if (!ourStoreId) {
          // A store we have not mapped: skip rather than invent an id.
          if (storeNumber) seenUnmappedStores.add(storeNumber);
          continue;
        }

        for (const employee of store.employees ?? []) {
          // Trust our own mapping over the echoed employee id.
          const userId =
            ourUserByEmployeeId.get((employee.EmployeeId ?? "").trim()) ?? ourUserId;

          for (const day of employee.days ?? []) {
            for (const action of day.actions ?? []) {
              const start = wallClock(action.StartTime);
              const end = wallClock(action.EndTime);
              const date = calendarDate(action.StartTime ?? day.Date);
              if (!start || !end || !date) continue;

              entries.push({
                userId,
                storeId: ourStoreId,
                date,
                startTime: start,
                endTime: end,
              });
            }
          }
        }
      }
    }

    if (seenUnmappedStores.size > 0) {
      console.warn(
        `TooEasy returned shifts for unmapped store number(s): ${[...seenUnmappedStores].join(", ")}. ` +
          `Map them at /admin/tooeasy.`
      );
    }

    return entries;
  }
}

type TooEasyShiftsResponse = {
  stores?: {
    StoreNumber?: string | null;
    StoreName?: string | null;
    employees?: {
      EmployeeId?: string | null;
      days?: {
        Date?: string | null;
        actions?: { StartTime?: string | null; EndTime?: string | null }[] | null;
      }[] | null;
    }[] | null;
  }[] | null;
};

/**
 * The token response has no schema in the spec — it is documented only as
 * "200 OK" — so the shape is unknown. This accepts a bare string or the field
 * names an ASP.NET service is most likely to use, and fails loudly rather than
 * silently returning nothing.
 */
function extractToken(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;

  // A bare quoted or unquoted JWT.
  if (!text.startsWith("{")) return text.replace(/^"|"$/g, "") || null;

  try {
    const body = JSON.parse(text) as Record<string, unknown>;
    for (const key of ["token", "access_token", "accessToken", "Token", "jwt"]) {
      const value = body[key];
      if (typeof value === "string" && value) return value;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * "2026-09-25T07:30:00" -> "07:30", taken literally.
 *
 * Deliberately string slicing rather than `new Date(...)`: parsing to an
 * instant and formatting back applies the server's timezone and can move a
 * shift by an hour. ShiftEntry carries local wall-clock, which is what the
 * schedule shows.
 */
function wallClock(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/T(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : null;
}

/** "2026-09-25T07:30:00" -> Date at midnight UTC, matching the manual import. */
function calendarDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
