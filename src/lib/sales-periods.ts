import { addDaysToDate, isDateString, weekStartOf } from "@/lib/schedule/time";

/**
 * The periods the statistics pages offer.
 *
 * One place, so the supplier page, the admin overview and the Excel export all
 * mean the same thing by "denna månad".
 */
export const PERIODS = ["7", "30", "week", "month", "custom"] as const;
export type PeriodKey = (typeof PERIODS)[number];

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  "7": "7 dagar",
  "30": "30 dagar",
  week: "Denna vecka",
  month: "Denna månad",
  custom: "Eget intervall",
};

export function toPeriod(value: unknown): PeriodKey {
  return (PERIODS as readonly string[]).includes(String(value))
    ? (value as PeriodKey)
    : "30";
}

export type Range = { from: string; to: string };

/**
 * Resolves a period to two dates.
 *
 * `today` is passed in so the boundaries are testable and so the caller
 * decides which timezone "today" means — Europe/Stockholm, everywhere.
 */
export function rangeFor(input: {
  period: PeriodKey;
  today: string;
  from?: string | null;
  to?: string | null;
}): Range {
  const { period, today } = input;

  if (period === "custom") {
    const from = isDateString(input.from) ? input.from : addDaysToDate(today, -29);
    const to = isDateString(input.to) ? input.to : today;
    // A backwards range is swapped rather than refused: it is a date picker
    // mistake, not an attack, and an empty page would not say so.
    return from <= to ? { from, to } : { from: to, to: from };
  }

  if (period === "week") return { from: weekStartOf(today), to: today };
  if (period === "month") return { from: `${today.slice(0, 7)}-01`, to: today };

  return { from: addDaysToDate(today, -(Number(period) - 1)), to: today };
}

/** The same length of time, immediately before — for "jämfört med". */
export function previousRange(range: Range): Range {
  const days = daysBetween(range.from, range.to);
  return {
    from: addDaysToDate(range.from, -(days + 1)),
    to: addDaysToDate(range.from, -1),
  };
}

export function daysBetween(from: string, to: string): number {
  const ms =
    new Date(`${to}T00:00:00.000Z`).getTime() - new Date(`${from}T00:00:00.000Z`).getTime();
  return Math.round(ms / 86_400_000);
}
