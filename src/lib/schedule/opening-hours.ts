/**
 * What a store's day looks like: when it is open, which shifts the one-tap
 * templates produce, and whether the hours are actually covered.
 *
 * Pure. The grid, the warnings and the coverage row all read from here, so
 * "is this shift outside opening hours?" has exactly one answer in the app.
 */
import {
  DAY_MINUTES,
  toMinutes,
  toTimeString,
  weekdayOf,
} from "@/lib/schedule/time";

export type WeekdayHours = {
  /** 1 = Monday ... 7 = Sunday. */
  weekday: number;
  opensAt: string;
  closesAt: string;
  closed: boolean;
};

export type OpeningException = {
  date: string;
  closed: boolean;
  opensAt: string | null;
  closesAt: string | null;
  note: string | null;
};

/**
 * A single day, after the weekly pattern and any exception for that date have
 * been resolved.
 *
 * `source` matters to the UI: "missing" is a store whose hours nobody has
 * entered yet, which must read as "öppettider saknas" and not as "stängt".
 * Those are very different things to a manager filling in a week.
 */
export type EffectiveHours = {
  date: string;
  weekday: number;
  closed: boolean;
  opensAt: string | null;
  closesAt: string | null;
  source: "weekday" | "exception" | "missing";
  note: string | null;
};

/**
 * How far outside opening hours a shift may run before it is warned about.
 *
 * Someone has to unlock, count the till and cash up, so the clock-hours are
 * never the shift hours. Configurable with SCHEDULE_SHIFT_BUFFER_MINUTES
 * because 30 minutes is a guess, not a rule.
 */
export const DEFAULT_BUFFER_MINUTES = 30;

export function parseBufferMinutes(raw: string | undefined): number {
  // An unset or blank variable means "use the default", not "zero minutes" —
  // Number("") is 0, which would quietly switch the warning off.
  if (raw === undefined || raw.trim() === "") return DEFAULT_BUFFER_MINUTES;

  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return DEFAULT_BUFFER_MINUTES;
  // Two hours either side is already generous; beyond that the "warning"
  // would never fire and the setting would be a way to switch it off.
  return Math.min(120, Math.round(value));
}

export function effectiveHoursFor(
  date: string,
  hours: WeekdayHours[],
  exceptions: OpeningException[] = []
): EffectiveHours {
  const weekday = weekdayOf(date);
  const exception = exceptions.find((candidate) => candidate.date === date);

  if (exception) {
    return {
      date,
      weekday,
      closed: exception.closed,
      opensAt: exception.closed ? null : exception.opensAt,
      closesAt: exception.closed ? null : exception.closesAt,
      source: "exception",
      note: exception.note,
    };
  }

  const weekly = hours.find((candidate) => candidate.weekday === weekday);
  if (!weekly) {
    return {
      date,
      weekday,
      closed: false,
      opensAt: null,
      closesAt: null,
      source: "missing",
      note: null,
    };
  }

  return {
    date,
    weekday,
    closed: weekly.closed,
    opensAt: weekly.closed ? null : weekly.opensAt,
    closesAt: weekly.closed ? null : weekly.closesAt,
    source: "weekday",
    note: null,
  };
}

/** True only when the day has usable hours to build a shift from. */
export function isOpen(
  hours: EffectiveHours
): hours is EffectiveHours & { opensAt: string; closesAt: string } {
  return !hours.closed && hours.opensAt !== null && hours.closesAt !== null;
}

export type ShiftTemplate = {
  id: "full" | "open" | "close";
  label: string;
  startsAt: string;
  endsAt: string;
};

/**
 * The three one-tap shifts for a day.
 *
 * "Hel dag" is exactly open to close, so the common case needs no thinking
 * about. The opening and closing halves take the buffer, because those are the
 * two shifts where the work starts before the door does and ends after it.
 * The split is rounded to the half hour — nobody rotas a handover at 14:07.
 */
export function shiftTemplates(hours: EffectiveHours, buffer: number): ShiftTemplate[] {
  if (!isOpen(hours)) return [];

  const opens = toMinutes(hours.opensAt);
  const closes = toMinutes(hours.closesAt);
  if (closes <= opens) return [];

  const midpoint = Math.round((opens + closes) / 2 / 30) * 30;

  return [
    { id: "full", label: "Hel dag", startsAt: hours.opensAt, endsAt: hours.closesAt },
    {
      id: "open",
      label: "Öppning",
      startsAt: toTimeString(Math.max(0, opens - buffer)),
      endsAt: toTimeString(midpoint),
    },
    {
      id: "close",
      label: "Stängning",
      startsAt: toTimeString(midpoint),
      endsAt: toTimeString(Math.min(DAY_MINUTES - 1, closes + buffer)),
    },
  ];
}

/**
 * Is the shift inside the opening hours, give or take the buffer?
 *
 * A closed day, or a day with no hours entered, cannot answer this, so both
 * come back false and the caller words the warning for the case it has.
 */
export function withinOpeningHours(
  shift: { startsAt: string; endsAt: string },
  hours: EffectiveHours,
  buffer: number
): boolean {
  if (!isOpen(hours)) return false;
  return (
    toMinutes(shift.startsAt) >= toMinutes(hours.opensAt) - buffer &&
    toMinutes(shift.endsAt) <= toMinutes(hours.closesAt) + buffer
  );
}

export type Interval = { from: string; to: string };

export type Coverage = {
  /** Null when the store is closed or has no hours for the day. */
  open: Interval | null;
  /** The staffed span inside opening hours, ignoring gaps in the middle. */
  staffed: Interval | null;
  /** Opening hours nobody is scheduled for. */
  gaps: Interval[];
};

/**
 * Which parts of the open day have somebody in the shop.
 *
 * Shifts are clipped to opening hours first: half an hour of cashing up after
 * closing is not coverage of anything, and counting it would hide a real gap
 * at the other end of the day.
 */
export function coverageFor(
  hours: EffectiveHours,
  shifts: { startsAt: string; endsAt: string }[]
): Coverage {
  if (!isOpen(hours)) return { open: null, staffed: null, gaps: [] };

  const opens = toMinutes(hours.opensAt);
  const closes = toMinutes(hours.closesAt);
  const open = { from: hours.opensAt, to: hours.closesAt };

  const clipped = shifts
    .map((shift) => ({
      from: Math.max(opens, toMinutes(shift.startsAt)),
      to: Math.min(closes, toMinutes(shift.endsAt)),
    }))
    .filter((span) => span.to > span.from)
    .sort((a, b) => a.from - b.from);

  if (clipped.length === 0) {
    return { open, staffed: null, gaps: [open] };
  }

  // Merge, then read the holes off between the merged blocks.
  const merged: { from: number; to: number }[] = [];
  for (const span of clipped) {
    const last = merged[merged.length - 1];
    if (last && span.from <= last.to) {
      last.to = Math.max(last.to, span.to);
      continue;
    }
    merged.push({ ...span });
  }

  const gaps: Interval[] = [];
  let cursor = opens;
  for (const block of merged) {
    if (block.from > cursor) gaps.push({ from: toTimeString(cursor), to: toTimeString(block.from) });
    cursor = Math.max(cursor, block.to);
  }
  if (cursor < closes) gaps.push({ from: toTimeString(cursor), to: toTimeString(closes) });

  return {
    open,
    staffed: {
      from: toTimeString(merged[0].from),
      to: toTimeString(merged[merged.length - 1].to),
    },
    gaps,
  };
}

/** "10:00" -> "10", "10:30" -> "10:30". The way a rota is read aloud. */
export function compactTime(time: string): string {
  return time.endsWith(":00") ? time.slice(0, 2).replace(/^0/, "") : time;
}

function compactRange(span: Interval): string {
  return `${compactTime(span.from)}–${compactTime(span.to)}`;
}

/**
 * The coverage line under a day column: "Öppet 10–20, bemannat 10–20", or the
 * gap when there is one.
 */
export function describeCoverage(hours: EffectiveHours, coverage: Coverage): string {
  if (hours.source === "missing") return "Öppettider saknas";
  if (!coverage.open) return "Stängt";

  const open = `Öppet ${compactRange(coverage.open)}`;
  if (!coverage.staffed) return `${open}, ingen bemannad`;

  if (coverage.gaps.length > 0) {
    const label = coverage.gaps.length === 1 ? "Lucka" : "Luckor";
    return `${open}, ${label.toLowerCase()} ${coverage.gaps.map(compactRange).join(", ")}`;
  }

  return `${open}, bemannat ${compactRange(coverage.staffed)}`;
}
