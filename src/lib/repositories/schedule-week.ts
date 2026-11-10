import { prisma } from "@/lib/db";
import {
  coverageFor,
  describeCoverage,
  effectiveHoursFor,
  parseBufferMinutes,
  shiftTemplates,
} from "@/lib/schedule/opening-hours";
import { isoWeekKey, weekDates, weekNumberOf, weekStartOf } from "@/lib/schedule/time";
import {
  planCopy,
  validateShift,
  warningsForDay,
  weekDateMap,
  type CopyPlan,
} from "@/lib/schedule/week";
import type {
  ChangeRow,
  ScheduleWeek,
  WeekDay,
  WeekRowEmployee,
  WeekShift,
} from "@/lib/schedule/grid";
import { listOpeningHours, listExceptions } from "@/lib/repositories/opening-hours";

/**
 * Reading and writing one store's week.
 *
 * Every write records who did it, prunes the trail, and leaves the shift rows
 * alone otherwise: there is no publish step, so what a manager types is live
 * the moment it saves.
 */

/** How long the "who changed what" trail is kept. */
export const CHANGE_LOG_RETENTION_DAYS = 90;

/** How many change rows a week view shows. */
export const CHANGE_LOG_PAGE = 20;

export function bufferMinutes(): number {
  return parseBufferMinutes(process.env.SCHEDULE_SHIFT_BUFFER_MINUTES);
}

export type {
  ChangeRow,
  ScheduleWeek,
  WeekDay,
  WeekRowEmployee,
  WeekShift,
} from "@/lib/schedule/grid";

/**
 * One store's week, with everything the grid needs already resolved.
 *
 * Employee rows are the store's own active staff plus anyone else who has a
 * shift here that week — a borrowed colleague has to appear on the grid, or
 * the coverage row and the person standing in the shop disagree.
 */
export async function getWeek(input: { storeId: string; date: string }): Promise<ScheduleWeek | null> {
  const monday = weekStartOf(input.date);
  const dates = weekDates(monday);
  const weekKey = isoWeekKey(monday);

  const [store, hours, exceptions, shifts, own, changes] = await Promise.all([
    prisma.store.findUnique({ where: { id: input.storeId }, select: { id: true, name: true } }),
    listOpeningHours(input.storeId),
    listExceptions(input.storeId, { from: dates[0], to: dates[6] }),
    prisma.scheduleShift.findMany({
      where: { storeId: input.storeId, date: { gte: dates[0], lte: dates[6] } },
      orderBy: [{ date: "asc" }, { startsAt: "asc" }],
      select: {
        id: true,
        date: true,
        startsAt: true,
        endsAt: true,
        note: true,
        extraShiftRequestId: true,
        employee: {
          select: { id: true, name: true, homeStoreId: true, homeStore: { select: { name: true } } },
        },
      },
    }),
    prisma.employee.findMany({
      where: { homeStoreId: input.storeId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, homeStore: { select: { name: true } } },
    }),
    listChanges(input.storeId, weekKey),
  ]);

  if (!store) return null;

  const employees: WeekRowEmployee[] = own.map((employee) => ({
    id: employee.id,
    name: employee.name,
    own: true,
    homeStoreName: employee.homeStore.name,
  }));
  const seen = new Set(employees.map((employee) => employee.id));

  for (const shift of shifts) {
    if (seen.has(shift.employee.id)) continue;
    seen.add(shift.employee.id);
    employees.push({
      id: shift.employee.id,
      name: shift.employee.name,
      own: shift.employee.homeStoreId === input.storeId,
      homeStoreName: shift.employee.homeStore.name,
    });
  }
  // Own staff first, then borrowed, each alphabetically.
  employees.sort(
    (a, b) => Number(b.own) - Number(a.own) || a.name.localeCompare(b.name, "sv")
  );

  const buffer = bufferMinutes();

  const days: WeekDay[] = dates.map((date) => {
    const effective = effectiveHoursFor(date, hours, exceptions);
    const dayShifts: WeekShift[] = shifts
      .filter((shift) => shift.date === date)
      .map((shift) => ({
        id: shift.id,
        employeeId: shift.employee.id,
        employeeName: shift.employee.name,
        startsAt: shift.startsAt,
        endsAt: shift.endsAt,
        note: shift.note,
        isExtra: shift.extraShiftRequestId !== null,
      }));

    const coverage = coverageFor(effective, dayShifts);

    return {
      date,
      hours: effective,
      coverage,
      coverageText: describeCoverage(effective, coverage),
      warnings: warningsForDay({ hours: effective, buffer, shifts: dayShifts, coverage }),
      templates: shiftTemplates(effective, buffer),
      shifts: dayShifts,
    };
  });

  return {
    store,
    monday,
    weekKey,
    weekNumber: weekNumberOf(monday),
    dates,
    buffer,
    days,
    employees,
    changes,
  };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export class ScheduleWriteError extends Error {}

export type SaveShiftInput = {
  /** Present when an existing shift is being edited. */
  id?: string | null;
  storeId: string;
  employeeId: string;
  date: string;
  startsAt: string;
  endsAt: string;
  note: string | null;
  userId: string;
};

/**
 * Creates or edits one shift.
 *
 * Saving the same person at the same start time twice is treated as an edit of
 * that shift rather than an error — a double tap on a phone must not produce a
 * failure the manager has to understand.
 */
export async function saveShift(input: SaveShiftInput): Promise<{ id: string }> {
  const validation = validateShift(input);
  if (!validation.ok) throw new ScheduleWriteError(validation.errors.join(" "));
  const draft = validation.value;

  const employee = await prisma.employee.findUnique({
    where: { id: draft.employeeId },
    select: { id: true, name: true, active: true },
  });
  if (!employee) throw new ScheduleWriteError("Okänd medarbetare.");
  if (!employee.active) throw new ScheduleWriteError("Medarbetaren är inaktiv.");

  const existingAtTime = await prisma.scheduleShift.findUnique({
    where: {
      employeeId_date_startsAt: {
        employeeId: draft.employeeId,
        date: draft.date,
        startsAt: draft.startsAt,
      },
    },
    select: { id: true, storeId: true },
  });

  const targetId = input.id || existingAtTime?.id || null;

  if (targetId) {
    // Scoped by store: an id from another store's grid cannot be edited here.
    const updated = await prisma.scheduleShift.updateMany({
      where: { id: targetId, storeId: input.storeId },
      data: {
        employeeId: draft.employeeId,
        date: draft.date,
        startsAt: draft.startsAt,
        endsAt: draft.endsAt,
        note: draft.note,
      },
    });
    if (updated.count === 0) throw new ScheduleWriteError("Passet finns inte längre.");

    await recordChange({
      storeId: input.storeId,
      date: draft.date,
      type: "UPDATED",
      userId: input.userId,
      detail: describeShift(employee.name, draft),
    });
    return { id: targetId };
  }

  const created = await prisma.scheduleShift.create({
    data: {
      employeeId: draft.employeeId,
      storeId: input.storeId,
      date: draft.date,
      startsAt: draft.startsAt,
      endsAt: draft.endsAt,
      note: draft.note,
      createdById: input.userId,
    },
    select: { id: true },
  });

  await recordChange({
    storeId: input.storeId,
    date: draft.date,
    type: "CREATED",
    userId: input.userId,
    detail: describeShift(employee.name, draft),
  });
  return created;
}

export async function deleteShift(input: {
  id: string;
  storeId: string;
  userId: string;
}): Promise<void> {
  const shift = await prisma.scheduleShift.findFirst({
    where: { id: input.id, storeId: input.storeId },
    select: {
      date: true,
      startsAt: true,
      endsAt: true,
      employee: { select: { name: true } },
    },
  });
  if (!shift) return;

  await prisma.scheduleShift.delete({ where: { id: input.id } });
  await recordChange({
    storeId: input.storeId,
    date: shift.date,
    type: "DELETED",
    userId: input.userId,
    detail: describeShift(shift.employee.name, shift),
  });
}

/**
 * "Ledig" — the day off.
 *
 * A day off is the absence of a shift, not a record of its own. There is
 * deliberately no absence row: once the app can store "ledig" it is one small
 * step from storing why, and a reason for an absence is health information.
 */
export async function clearDay(input: {
  storeId: string;
  employeeId: string;
  date: string;
  userId: string;
}): Promise<number> {
  const employee = await prisma.employee.findUnique({
    where: { id: input.employeeId },
    select: { name: true },
  });

  const removed = await prisma.scheduleShift.deleteMany({
    where: { storeId: input.storeId, employeeId: input.employeeId, date: input.date },
  });

  if (removed.count > 0) {
    await recordChange({
      storeId: input.storeId,
      date: input.date,
      type: "DAY_OFF",
      userId: input.userId,
      detail: `${employee?.name ?? "Medarbetare"} · ledig`,
    });
  }
  return removed.count;
}

// ---------------------------------------------------------------------------
// Copying
// ---------------------------------------------------------------------------

/**
 * What copying one week onto another would do. Nothing is written.
 *
 * `sourceDate` and `targetDate` may be any day in their weeks; both are
 * snapped to the Monday, so "copy last week" is a date minus seven.
 */
export async function previewCopyWeek(input: {
  storeId: string;
  sourceDate: string;
  targetDate: string;
}): Promise<CopyPlan> {
  const source = weekDates(weekStartOf(input.sourceDate));
  const target = weekDates(weekStartOf(input.targetDate));
  return previewCopy({ storeId: input.storeId, dateMap: weekDateMap(source, target) });
}

export async function previewCopyDay(input: {
  storeId: string;
  sourceDate: string;
  targetDate: string;
}): Promise<CopyPlan> {
  return previewCopy({
    storeId: input.storeId,
    dateMap: new Map([[input.sourceDate, input.targetDate]]),
  });
}

async function previewCopy(input: {
  storeId: string;
  dateMap: Map<string, string>;
}): Promise<CopyPlan> {
  const sourceDates = [...input.dateMap.keys()];
  const targetDates = [...input.dateMap.values()];

  const [sourceShifts, existing, employees, hours, exceptions] = await Promise.all([
    prisma.scheduleShift.findMany({
      where: { storeId: input.storeId, date: { in: sourceDates } },
      orderBy: [{ date: "asc" }, { startsAt: "asc" }],
      select: {
        date: true,
        startsAt: true,
        endsAt: true,
        note: true,
        extraShiftRequestId: true,
        employee: { select: { id: true, name: true } },
      },
    }),
    prisma.scheduleShift.findMany({
      where: { storeId: input.storeId, date: { in: targetDates } },
      select: { employeeId: true, date: true, startsAt: true },
    }),
    prisma.employee.findMany({
      where: { homeStoreId: input.storeId, active: true },
      select: { id: true },
    }),
    listOpeningHours(input.storeId),
    listExceptions(input.storeId, {
      from: [...targetDates].sort()[0],
      to: [...targetDates].sort().at(-1)!,
    }),
  ]);

  const closedDates = targetDates.filter((date) => {
    const effective = effectiveHoursFor(date, hours, exceptions);
    return effective.closed;
  });

  return planCopy({
    source: sourceShifts.map((shift) => ({
      employeeId: shift.employee.id,
      employeeName: shift.employee.name,
      date: shift.date,
      startsAt: shift.startsAt,
      endsAt: shift.endsAt,
      note: shift.note,
    })),
    dateMap: input.dateMap,
    existing,
    closedDates,
    schedulableEmployeeIds: employees.map((employee) => employee.id),
    borrowedEmployeeIds: sourceShifts
      .filter((shift) => shift.extraShiftRequestId !== null)
      .map((shift) => shift.employee.id),
  });
}

/**
 * Applies a plan.
 *
 * The plan is recomputed here rather than trusted from the client: the preview
 * the manager saw is a few seconds old, and in between somebody else may have
 * filled the same slot. Recomputing means "nothing is overwritten" holds even
 * then — the only cost is that the applied plan can be smaller than the one on
 * screen, which is the safe direction.
 */
export async function applyCopy(input: {
  storeId: string;
  sourceDate: string;
  targetDate: string;
  scope: "week" | "day";
  userId: string;
}): Promise<{ created: number; skipped: number }> {
  const plan =
    input.scope === "week"
      ? await previewCopyWeek(input)
      : await previewCopyDay(input);

  if (plan.create.length === 0) return { created: 0, skipped: plan.skipped.length };

  await prisma.$transaction(
    plan.create.map((candidate) =>
      prisma.scheduleShift.create({
        data: {
          employeeId: candidate.employeeId,
          storeId: input.storeId,
          date: candidate.date,
          startsAt: candidate.startsAt,
          endsAt: candidate.endsAt,
          note: candidate.note,
          createdById: input.userId,
        },
      })
    )
  );

  await recordChange({
    storeId: input.storeId,
    date: input.targetDate,
    type: input.scope === "week" ? "COPIED_WEEK" : "COPIED_DAY",
    userId: input.userId,
    detail:
      input.scope === "week"
        ? `${plan.create.length} pass kopierade från vecka ${weekNumberOf(input.sourceDate)}`
        : `${plan.create.length} pass kopierade från ${input.sourceDate}`,
  });

  return { created: plan.create.length, skipped: plan.skipped.length };
}

// ---------------------------------------------------------------------------
// Change trail
// ---------------------------------------------------------------------------

function describeShift(
  name: string,
  shift: { date: string; startsAt: string; endsAt: string }
): string {
  return `${name} · ${shift.date} ${shift.startsAt}–${shift.endsAt}`;
}

/**
 * Records a change and prunes the store's old rows.
 *
 * Pruned on write rather than on a schedule: there is no job runner in this
 * app, and a trail that grows without limit is a personal-data store nobody
 * decided to keep.
 */
export async function recordChange(input: {
  storeId: string;
  date: string;
  type: string;
  userId: string | null;
  detail: string | null;
}): Promise<void> {
  const cutoff = new Date(Date.now() - CHANGE_LOG_RETENTION_DAYS * 86_400_000);

  await prisma.$transaction([
    prisma.scheduleChange.create({
      data: {
        storeId: input.storeId,
        weekKey: isoWeekKey(input.date),
        type: input.type,
        userId: input.userId,
        detail: input.detail,
      },
    }),
    prisma.scheduleChange.deleteMany({
      where: { storeId: input.storeId, createdAt: { lt: cutoff } },
    }),
  ]);
}

export async function listChanges(storeId: string, weekKey: string): Promise<ChangeRow[]> {
  const rows = await prisma.scheduleChange.findMany({
    where: { storeId, weekKey },
    orderBy: { createdAt: "desc" },
    take: CHANGE_LOG_PAGE,
    select: {
      id: true,
      type: true,
      detail: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    detail: row.detail,
    at: row.createdAt,
    byName: row.user?.name ?? row.user?.email ?? null,
  }));
}

/** One employee's own upcoming shifts, for "Mitt schema". */
export async function upcomingShiftsForEmployee(input: {
  employeeId: string;
  from: string;
  to: string;
}): Promise<
  { id: string; date: string; startsAt: string; endsAt: string; note: string | null; storeName: string; isExtra: boolean }[]
> {
  const shifts = await prisma.scheduleShift.findMany({
    where: { employeeId: input.employeeId, date: { gte: input.from, lte: input.to } },
    orderBy: [{ date: "asc" }, { startsAt: "asc" }],
    select: {
      id: true,
      date: true,
      startsAt: true,
      endsAt: true,
      note: true,
      extraShiftRequestId: true,
      store: { select: { name: true } },
    },
  });

  return shifts.map((shift) => ({
    id: shift.id,
    date: shift.date,
    startsAt: shift.startsAt,
    endsAt: shift.endsAt,
    note: shift.note,
    storeName: shift.store.name,
    isExtra: shift.extraShiftRequestId !== null,
  }));
}

/** Does this store have any schedule at all yet? Drives the empty state. */
export async function countShiftsForStores(storeIds: string[]): Promise<number> {
  if (storeIds.length === 0) return 0;
  return prisma.scheduleShift.count({ where: { storeId: { in: storeIds } } });
}
