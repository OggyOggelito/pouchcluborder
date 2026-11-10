/**
 * Local dates and wall-clock times, as strings.
 *
 * The whole manual schedule is wall-clock: "2026-11-04" and "10:00" mean what
 * a person standing in the shop would read off the wall, and nothing here ever
 * builds an instant out of them. That is the point — Sweden moves its clocks
 * twice a year, and a shift stored as an instant moves with them. The last
 * Sunday in October would hand everybody an extra hour and the last Sunday in
 * March would take one away, silently, from a grid nobody re-checks.
 *
 * Where a `Date` is unavoidable (the ScheduleProvider interface returns one)
 * it is built at midnight UTC, which is the convention the imported `Shift`
 * table already uses.
 *
 * Pure, so the rules can be tested without a database, a request or a zone.
 */

export const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** Minutes in a day. Used to clamp a buffer rather than wrap past midnight. */
export const DAY_MINUTES = 24 * 60;

export function isTimeString(value: unknown): value is string {
  return typeof value === "string" && TIME_PATTERN.test(value);
}

export function isDateString(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  // Rejects 2026-02-30: the pattern allows any day up to 31 per month.
  return toUtcDate(value).toISOString().slice(0, 10) === value;
}

/** "07:30" -> 450. Throws on anything that is not a time, so callers validate. */
export function toMinutes(time: string): number {
  const match = TIME_PATTERN.exec(time);
  if (!match) throw new Error(`Not a time: ${time}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

/** 450 -> "07:30". Clamped to the day; never wraps. */
export function toTimeString(minutes: number): string {
  const clamped = Math.max(0, Math.min(DAY_MINUTES - 1, Math.round(minutes)));
  const hours = Math.floor(clamped / 60);
  return `${String(hours).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

/** Midnight UTC for a local date string — the `Date` the app stores. */
export function toUtcDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

/** The inverse. A `Date` at midnight UTC back to "2026-11-04". */
export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDaysToDate(date: string, days: number): string {
  const next = toUtcDate(date);
  next.setUTCDate(next.getUTCDate() + days);
  return toDateString(next);
}

/** 1 = Monday ... 7 = Sunday, the way StoreOpeningHours.weekday is numbered. */
export function weekdayOf(date: string): number {
  const day = toUtcDate(date).getUTCDay();
  return day === 0 ? 7 : day;
}

/** The Monday of the week a date falls in. */
export function weekStartOf(date: string): string {
  return addDaysToDate(date, 1 - weekdayOf(date));
}

/** Monday to Sunday, as seven date strings. */
export function weekDates(monday: string): string[] {
  return Array.from({ length: 7 }, (_, offset) => addDaysToDate(monday, offset));
}

/**
 * "2026-W45" — ISO-8601 week numbering, which is what a Swedish rota means by
 * "vecka 45". Thursday decides the year, so the turn of the year lands in the
 * same week for everyone.
 */
export function isoWeekKey(date: string): string {
  const thursday = toUtcDate(date);
  thursday.setUTCDate(thursday.getUTCDate() + 4 - weekdayOf(date));

  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);

  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Just the number, for "Vecka 45". */
export function weekNumberOf(date: string): number {
  return Number(isoWeekKey(date).slice(-2));
}

const SHORT_DATE = new Intl.DateTimeFormat("sv-SE", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/**
 * "ons 4 nov". Formatted in UTC on purpose: the string is already a local
 * date, so re-interpreting it in Europe/Stockholm would be a second
 * conversion of something that was never an instant.
 */
export function formatDateString(date: string): string {
  return SHORT_DATE.format(toUtcDate(date));
}

const LONG_DATE = new Intl.DateTimeFormat("sv-SE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/** "onsdag 4 november", for a heading. */
export function formatLongDateString(date: string): string {
  return LONG_DATE.format(toUtcDate(date));
}

export const WEEKDAY_SHORT: Record<number, string> = {
  1: "mån",
  2: "tis",
  3: "ons",
  4: "tors",
  5: "fre",
  6: "lör",
  7: "sön",
};

export const WEEKDAY_LONG: Record<number, string> = {
  1: "måndag",
  2: "tisdag",
  3: "onsdag",
  4: "torsdag",
  5: "fredag",
  6: "lördag",
  7: "söndag",
};

/** "10:00–18:00", with the Swedish en dash and no spaces. */
export function formatRange(startsAt: string, endsAt: string): string {
  return `${startsAt}–${endsAt}`;
}

export function durationMinutes(startsAt: string, endsAt: string): number {
  return toMinutes(endsAt) - toMinutes(startsAt);
}

/**
 * Do two intervals share any time at all?
 *
 * Touching is not overlapping: 10:00–14:00 and 14:00–18:00 is a handover, and
 * warning about it would train people to ignore the warnings.
 */
export function overlaps(
  a: { startsAt: string; endsAt: string },
  b: { startsAt: string; endsAt: string }
): boolean {
  return toMinutes(a.startsAt) < toMinutes(b.endsAt) && toMinutes(b.startsAt) < toMinutes(a.endsAt);
}

/** Hours to one decimal, "7,5 h" — for a day's total on the grid. */
export function formatHours(minutes: number): string {
  const hours = minutes / 60;
  const text = Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace(".", ",");
  return `${text} h`;
}
