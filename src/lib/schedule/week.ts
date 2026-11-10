/**
 * The rules the week grid runs on: what a valid shift is, what is worth
 * warning about, and what "copy last week" would actually do.
 *
 * Every rule here warns. None of them blocks.
 *
 * That is deliberate. A store sometimes genuinely needs a shift that starts
 * before opening, two people whose hours touch, or somebody in on a closed
 * Sunday for a stock count. A grid that refuses to record what the shop is
 * actually doing gets worked around in a chat group, and then the portal is
 * wrong. So the grid says what looks odd and saves it anyway.
 *
 * Pure, so the warnings can be tested without a database.
 */
import {
  compactTime,
  coverageFor,
  isOpen,
  withinOpeningHours,
  type Coverage,
  type EffectiveHours,
} from "@/lib/schedule/opening-hours";
import {
  formatRange,
  isDateString,
  isTimeString,
  overlaps,
  toMinutes,
} from "@/lib/schedule/time";

/** Enough for "Ensam, leverans 14", not enough for a paragraph about a person. */
export const MAX_SHIFT_NOTE_LENGTH = 120;

/** A shift shorter than this is almost always a typo. Still only a warning. */
const SHORT_SHIFT_MINUTES = 30;

export type ShiftDraft = {
  employeeId: string;
  date: string;
  startsAt: string;
  endsAt: string;
  note: string | null;
};

export type ShiftValidation =
  | { ok: true; value: ShiftDraft }
  | { ok: false; errors: string[] };

/**
 * The one check both the grid and the server action run.
 *
 * These are the only refusals in the feature — a date that is not a date, a
 * time that is not a time, an end before its start, a note too long to be
 * about a shift. Everything else is a warning.
 */
export function validateShift(input: {
  employeeId: string;
  date: string;
  startsAt: string;
  endsAt: string;
  note?: string | null;
}): ShiftValidation {
  const errors: string[] = [];

  if (!input.employeeId) errors.push("Välj en medarbetare.");
  if (!isDateString(input.date)) errors.push("Ogiltigt datum.");
  if (!isTimeString(input.startsAt)) errors.push("Starttiden måste vara ett klockslag, t.ex. 10:00.");
  if (!isTimeString(input.endsAt)) errors.push("Sluttiden måste vara ett klockslag, t.ex. 18:00.");

  if (isTimeString(input.startsAt) && isTimeString(input.endsAt)) {
    if (toMinutes(input.endsAt) <= toMinutes(input.startsAt)) {
      errors.push("Sluttiden måste vara efter starttiden.");
    }
  }

  const note = (input.note ?? "").trim();
  if (note.length > MAX_SHIFT_NOTE_LENGTH) {
    errors.push(`Anteckningen får vara högst ${MAX_SHIFT_NOTE_LENGTH} tecken.`);
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      employeeId: input.employeeId,
      date: input.date,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      note: note || null,
    },
  };
}

export type WarningKind =
  | "NO_HOURS"
  | "CLOSED_DAY"
  | "OUTSIDE_HOURS"
  | "OVERLAP"
  | "SHORT_SHIFT"
  | "UNSTAFFED"
  | "GAP";

export type ScheduleWarning = {
  kind: WarningKind;
  /** The day it belongs to, so the grid can put it in the right column. */
  date: string;
  /** Already in Swedish and already safe to render. */
  text: string;
};

export type DayShift = {
  id: string;
  employeeId: string;
  employeeName: string;
  startsAt: string;
  endsAt: string;
};

/**
 * Everything odd about one day.
 *
 * Ordered worst first: a shop with nobody in it outranks a shift that starts
 * ten minutes early, and on a phone only the first line or two gets read.
 */
export function warningsForDay(input: {
  hours: EffectiveHours;
  buffer: number;
  shifts: DayShift[];
  /** Pass the already-computed coverage to avoid doing the work twice. */
  coverage?: Coverage;
}): ScheduleWarning[] {
  const { hours, buffer, shifts } = input;
  const date = hours.date;
  const warnings: ScheduleWarning[] = [];
  const coverage = input.coverage ?? coverageFor(hours, shifts);

  if (hours.source === "missing") {
    warnings.push({
      kind: "NO_HOURS",
      date,
      text: "Öppettider saknas för den här dagen — lägg in dem så visas luckor och mallar.",
    });
  }

  if (isOpen(hours) && shifts.length === 0) {
    warnings.push({ kind: "UNSTAFFED", date, text: "Ingen är inlagd den här dagen." });
  }

  for (const gap of coverage.gaps) {
    // A day with nobody at all already said so; listing the whole day as a
    // gap as well would be the same sentence twice.
    if (shifts.length === 0) break;
    warnings.push({
      kind: "GAP",
      date,
      text: `Lucka ${compactTime(gap.from)}–${compactTime(gap.to)} — ingen är inlagd då.`,
    });
  }

  if (hours.closed && shifts.length > 0) {
    warnings.push({
      kind: "CLOSED_DAY",
      date,
      text:
        shifts.length === 1
          ? "Butiken är stängd, men ett pass är inlagt."
          : `Butiken är stängd, men ${shifts.length} pass är inlagda.`,
    });
  }

  for (const shift of shifts) {
    if (isOpen(hours) && !withinOpeningHours(shift, hours, buffer)) {
      warnings.push({
        kind: "OUTSIDE_HOURS",
        date,
        text: `${shift.employeeName} ${formatRange(shift.startsAt, shift.endsAt)} ligger utanför öppettiderna med mer än ${buffer} min.`,
      });
    }
    if (toMinutes(shift.endsAt) - toMinutes(shift.startsAt) < SHORT_SHIFT_MINUTES) {
      warnings.push({
        kind: "SHORT_SHIFT",
        date,
        text: `${shift.employeeName} har ett pass på under ${SHORT_SHIFT_MINUTES} minuter — stämmer tiderna?`,
      });
    }
  }

  // Overlaps are per person. Two people in the shop at once is coverage;
  // one person in two places is a mistake.
  const byEmployee = new Map<string, DayShift[]>();
  for (const shift of shifts) {
    byEmployee.set(shift.employeeId, [...(byEmployee.get(shift.employeeId) ?? []), shift]);
  }
  for (const own of byEmployee.values()) {
    for (let i = 0; i < own.length; i += 1) {
      for (let j = i + 1; j < own.length; j += 1) {
        if (!overlaps(own[i], own[j])) continue;
        warnings.push({
          kind: "OVERLAP",
          date,
          text: `${own[i].employeeName} har två pass som krockar: ${formatRange(own[i].startsAt, own[i].endsAt)} och ${formatRange(own[j].startsAt, own[j].endsAt)}.`,
        });
      }
    }
  }

  const rank: Record<WarningKind, number> = {
    UNSTAFFED: 0,
    GAP: 1,
    OVERLAP: 2,
    CLOSED_DAY: 3,
    OUTSIDE_HOURS: 4,
    SHORT_SHIFT: 5,
    NO_HOURS: 6,
  };
  return warnings.sort((a, b) => rank[a.kind] - rank[b.kind]);
}

// ---------------------------------------------------------------------------
// Copying
// ---------------------------------------------------------------------------

export type CopyCandidate = {
  employeeId: string;
  employeeName: string;
  /** The destination date, not the source one. */
  date: string;
  startsAt: string;
  endsAt: string;
  note: string | null;
  /** True when the store is closed on the destination date. */
  onClosedDay: boolean;
};

export type CopySkipReason = "DUPLICATE" | "INACTIVE" | "BORROWED";

export const COPY_SKIP_LABELS: Record<CopySkipReason, string> = {
  DUPLICATE: "Redan inlagt",
  INACTIVE: "Medarbetaren är inaktiv",
  BORROWED: "Extrapass — måste frågas om igen",
};

export type CopySkip = { candidate: CopyCandidate; reason: CopySkipReason };

export type CopyPlan = { create: CopyCandidate[]; skipped: CopySkip[] };

/**
 * What a copy would do, without doing it.
 *
 * Shown as a preview and then applied from the same plan, so what the manager
 * agreed to is what gets written.
 *
 * Three things are left alone. A destination that already has that person at
 * that start time keeps what it has — a copy never overwrites. Somebody who
 * has since left is not resurrected. And a borrowed shift is not copied at
 * all: an extra pass is somebody else's staff, agreed to once, for one day.
 * Repeating it by copying a week would commit another store's employee to work
 * nobody asked them about.
 */
export function planCopy(input: {
  /** Shifts to copy from, already scoped to one store. */
  source: {
    employeeId: string;
    employeeName: string;
    date: string;
    startsAt: string;
    endsAt: string;
    note: string | null;
  }[];
  /** Source date -> destination date. A source date that is absent is dropped. */
  dateMap: Map<string, string>;
  /** What the destination already holds, so nothing is overwritten. */
  existing: { employeeId: string; date: string; startsAt: string }[];
  /** Destination dates where the store is closed. Copied, but flagged. */
  closedDates?: string[];
  /** Employee ids this store may schedule — its own, still active. */
  schedulableEmployeeIds: string[];
  /** Employee ids whose shifts here came from an extra-shift request. */
  borrowedEmployeeIds?: string[];
}): CopyPlan {
  const taken = new Set(
    input.existing.map((shift) => `${shift.employeeId}|${shift.date}|${shift.startsAt}`)
  );
  const closed = new Set(input.closedDates ?? []);
  const schedulable = new Set(input.schedulableEmployeeIds);
  const borrowed = new Set(input.borrowedEmployeeIds ?? []);

  const plan: CopyPlan = { create: [], skipped: [] };

  for (const shift of input.source) {
    const date = input.dateMap.get(shift.date);
    if (!date) continue;

    const candidate: CopyCandidate = {
      employeeId: shift.employeeId,
      employeeName: shift.employeeName,
      date,
      startsAt: shift.startsAt,
      endsAt: shift.endsAt,
      note: shift.note,
      onClosedDay: closed.has(date),
    };

    if (borrowed.has(shift.employeeId)) {
      plan.skipped.push({ candidate, reason: "BORROWED" });
      continue;
    }
    if (!schedulable.has(shift.employeeId)) {
      plan.skipped.push({ candidate, reason: "INACTIVE" });
      continue;
    }
    if (taken.has(`${candidate.employeeId}|${candidate.date}|${candidate.startsAt}`)) {
      plan.skipped.push({ candidate, reason: "DUPLICATE" });
      continue;
    }

    // Guards against a source week that itself holds two identical rows,
    // which the unique constraint would otherwise reject mid-apply.
    taken.add(`${candidate.employeeId}|${candidate.date}|${candidate.startsAt}`);
    plan.create.push(candidate);
  }

  return plan;
}

/** Monday-to-Monday mapping for "kopiera förra veckan". */
export function weekDateMap(sourceDates: string[], targetDates: string[]): Map<string, string> {
  return new Map(sourceDates.map((date, index) => [date, targetDates[index]]));
}
