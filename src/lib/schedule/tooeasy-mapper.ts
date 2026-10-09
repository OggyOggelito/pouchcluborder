/**
 * Pure logic for the TooEasy provider: token parsing, the date window, and
 * mapping their nested payload onto ShiftEntry.
 *
 * Kept free of fetch and Prisma so it can be tested against fixtures rather
 * than a live account.
 */
import type { ShiftEntry } from "@/lib/schedule/types";

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------

export type ParsedToken = {
  token: string;
  /** Epoch ms, from an expiry field or the JWT's own `exp`. Null if unknown. */
  expiresAt: number | null;
  /** Which field it came from — reported by the probe, never logged in prod. */
  field: string;
};

const TOKEN_FIELDS = ["token", "access_token", "accessToken", "Token", "jwt"] as const;
const EXPIRY_FIELDS = ["expires_in", "expiresIn", "expires", "expiry", "expiresAt"] as const;

/**
 * The spec documents this response only as `200 OK` with no schema, so the
 * shape is discovered at runtime. `scripts/tooeasy-probe.ts` reports which
 * field was used; once confirmed this can be narrowed to that one.
 */
export function parseTokenResponse(raw: string, now = Date.now()): ParsedToken | null {
  const text = raw.trim();
  if (!text) return null;

  if (!text.startsWith("{")) {
    const bare = stripBearer(text.replace(/^"|"$/g, ""));
    return bare ? { token: bare, expiresAt: expFromJwt(bare), field: "(bare string)" } : null;
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }

  for (const field of TOKEN_FIELDS) {
    const value = body[field];
    if (typeof value !== "string" || !value) continue;

    const token = stripBearer(value);
    return { token, expiresAt: expiryFrom(body, token, now), field };
  }
  return null;
}

/** Some services return "Bearer eyJ..." in the token field itself. */
function stripBearer(value: string): string {
  return value.replace(/^Bearer\s+/i, "").trim();
}

function expiryFrom(
  body: Record<string, unknown>,
  token: string,
  now: number
): number | null {
  for (const field of EXPIRY_FIELDS) {
    const value = body[field];
    if (typeof value === "number" && Number.isFinite(value)) {
      // Small numbers are a lifetime in seconds; large ones an epoch.
      return value < 10_000_000 ? now + value * 1000 : value * 1000;
    }
    if (typeof value === "string" && value) {
      const parsed = Date.parse(value);
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  return expFromJwt(token);
}

/** Reads `exp` out of a JWT payload without verifying the signature. */
export function expFromJwt(token: string): number | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
    ) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Date window
// ---------------------------------------------------------------------------

export type DateWindow = { startDate: string; numberOfDaysBack: number };

/**
 * `GET /api/Schedule/GetItemsForAction` takes `startDate` plus
 * `numberOfDaysBack`, i.e. it counts backwards from a date. A forward range is
 * therefore requested by anchoring on its last day and reaching back across it.
 *
 * ASSUMPTION — both ends inclusive, so a 14-day range is 14 days back from the
 * final day. `scripts/tooeasy-probe.ts` checks this against real data; if the
 * window turns out to be exclusive at one end, this function is the only place
 * that changes.
 */
export function toDateWindow(from: Date, to: Date): DateWindow {
  const days =
    Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000)) + 1;
  return { startDate: isoDate(to), numberOfDaysBack: days };
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Payload -> ShiftEntry
// ---------------------------------------------------------------------------

export type TooEasyShiftsResponse = {
  stores?: TooEasyStore[] | null;
};

type TooEasyStore = {
  StoreNumber?: string | null;
  StoreName?: string | null;
  employees?: TooEasyEmployee[] | null;
};

type TooEasyEmployee = {
  EmployeeId?: string | null;
  days?: TooEasyDay[] | null;
};

type TooEasyDay = {
  Date?: string | null;
  actions?: TooEasyPass[] | null;
};

/**
 * Only the four fields we need are declared. `Pass` also carries TotalCost,
 * OBCost, PayrollTaxes and CostExPayrollTax — payroll figures that must never
 * reach ShiftEntry, so they are not read at all.
 */
type TooEasyPass = {
  StartTime?: string | null;
  EndTime?: string | null;
};

export type MapResult = {
  entries: ShiftEntry[];
  /** TooEasy store numbers we have no mapping for; their shifts are skipped. */
  unmappedStoreNumbers: string[];
  /** TooEasy employee ids we have no mapping for. */
  unmappedEmployeeIds: string[];
};

/**
 * Maps their nested payload onto ShiftEntry.
 *
 * Anything we cannot resolve to one of our own records is skipped and reported
 * rather than guessed: a shift attached to the wrong store or person is worse
 * than a missing one.
 */
export function mapShiftsResponse(
  payload: TooEasyShiftsResponse | null | undefined,
  maps: {
    /** TooEasy EmployeeId -> our User.id */
    userByEmployeeId: Map<string, string>;
    /** TooEasy StoreNumber -> our Store.id */
    storeByNumber: Map<string, string>;
  }
): MapResult {
  const entries: ShiftEntry[] = [];
  const unmappedStoreNumbers = new Set<string>();
  const unmappedEmployeeIds = new Set<string>();

  for (const store of payload?.stores ?? []) {
    const storeNumber = (store?.StoreNumber ?? "").trim();
    const storeId = maps.storeByNumber.get(storeNumber);

    if (!storeId) {
      if (storeNumber) unmappedStoreNumbers.add(storeNumber);
      continue;
    }

    for (const employee of store?.employees ?? []) {
      const employeeId = (employee?.EmployeeId ?? "").trim();
      const userId = maps.userByEmployeeId.get(employeeId);

      if (!userId) {
        if (employeeId) unmappedEmployeeIds.add(employeeId);
        continue;
      }

      for (const day of employee?.days ?? []) {
        for (const action of day?.actions ?? []) {
          const startTime = wallClock(action?.StartTime);
          const endTime = wallClock(action?.EndTime);
          const date = calendarDate(action?.StartTime ?? day?.Date);
          if (!startTime || !endTime || !date) continue;

          entries.push({ userId, storeId, date, startTime, endTime });
        }
      }
    }
  }

  return {
    entries,
    unmappedStoreNumbers: [...unmappedStoreNumbers],
    unmappedEmployeeIds: [...unmappedEmployeeIds],
  };
}

/**
 * "2026-09-25T07:30:00" -> "07:30", taken literally.
 *
 * Deliberately string slicing rather than `new Date(...)`: parsing to an
 * instant and formatting back applies the running server's timezone, which
 * moves a shift by an hour — and by a different hour either side of a DST
 * change. ShiftEntry carries local wall-clock, which is what a schedule shows.
 *
 * A value that carries an explicit UTC offset is NOT local wall-clock, so it is
 * rejected rather than silently mis-read; see `hasUtcOffset`.
 */
export function wallClock(value: string | null | undefined): string | null {
  if (!value) return null;
  if (hasUtcOffset(value)) return null;
  const match = value.match(/T(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : null;
}

/** True for "…Z" or "…+02:00" — an instant rather than a local wall-clock. */
export function hasUtcOffset(value: string): boolean {
  return /T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/.test(value.trim());
}

/** "2026-09-25T07:30:00" -> midnight UTC, matching the manual import. */
export function calendarDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

// ---------------------------------------------------------------------------
// Employee directory (mapping dropdown)
// ---------------------------------------------------------------------------

export type TooEasyEmployeeOption = {
  employeeId: string;
  displayName: string;
  inactive: boolean;
};

/** Only the fields we are willing to read off `EmployeeMDL`. */
export type RawEmployeeRow = {
  EmployeeId?: unknown;
  FirstName?: unknown;
  LastName?: unknown;
  Inactive?: unknown;
  ProtectedIdentity?: unknown;
};

/**
 * Reduces `EmployeeMDL` (76 fields, including PersonalIdentityNum) to the two
 * values the dropdown needs.
 *
 * Anyone with ProtectedIdentity is excluded outright and only counted — their
 * name must not reach a page. Everything other than the employee number and a
 * display name is dropped here and never copied anywhere else.
 */
export function stripEmployeeRows(rows: RawEmployeeRow[]): {
  options: TooEasyEmployeeOption[];
  protectedCount: number;
} {
  const options: TooEasyEmployeeOption[] = [];
  let protectedCount = 0;

  for (const row of rows ?? []) {
    if (row?.ProtectedIdentity === true) {
      protectedCount += 1;
      continue;
    }

    const employeeId = typeof row?.EmployeeId === "string" ? row.EmployeeId.trim() : "";
    if (!employeeId) continue;

    const first = typeof row?.FirstName === "string" ? row.FirstName.trim() : "";
    const last = typeof row?.LastName === "string" ? row.LastName.trim() : "";

    options.push({
      employeeId,
      displayName: [first, last].filter(Boolean).join(" ") || employeeId,
      inactive: row?.Inactive === true,
    });
  }

  options.sort((a, b) => a.displayName.localeCompare(b.displayName, "sv"));
  return { options, protectedCount };
}

/** Fold case and diacritics so "Åsa Öberg" and "asa oberg" compare equal. */
function normaliseName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A hint only, never auto-saved. Returns a candidate when exactly one TooEasy
 * name folds to ours; an ambiguous or absent match returns nothing, because a
 * wrong mapping silently shows someone else's shifts.
 */
export function suggestMatch(
  ourName: string | null | undefined,
  options: TooEasyEmployeeOption[]
): TooEasyEmployeeOption | null {
  if (!ourName?.trim()) return null;
  const target = normaliseName(ourName);
  const matches = options.filter((option) => normaliseName(option.displayName) === target);
  return matches.length === 1 ? matches[0] : null;
}
