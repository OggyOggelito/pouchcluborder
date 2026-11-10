import { prisma } from "@/lib/db";
import {
  effectiveHoursFor,
  type EffectiveHours,
  type OpeningException,
  type WeekdayHours,
} from "@/lib/schedule/opening-hours";
import { isDateString, isTimeString } from "@/lib/schedule/time";

export type OpeningHoursRow = WeekdayHours & { id: string };

export async function listOpeningHours(storeId: string): Promise<OpeningHoursRow[]> {
  const rows = await prisma.storeOpeningHours.findMany({
    where: { storeId },
    orderBy: { weekday: "asc" },
    select: { id: true, weekday: true, opensAt: true, closesAt: true, closed: true },
  });
  return rows;
}

/** Every store's week in one query, for views that span stores. */
export async function openingHoursByStore(
  storeIds: string[]
): Promise<Map<string, WeekdayHours[]>> {
  if (storeIds.length === 0) return new Map();

  const rows = await prisma.storeOpeningHours.findMany({
    where: { storeId: { in: storeIds } },
    orderBy: { weekday: "asc" },
    select: { storeId: true, weekday: true, opensAt: true, closesAt: true, closed: true },
  });

  const byStore = new Map<string, WeekdayHours[]>();
  for (const row of rows) {
    byStore.set(row.storeId, [...(byStore.get(row.storeId) ?? []), row]);
  }
  return byStore;
}

/**
 * Writes one weekday.
 *
 * The times are kept even when the day is marked closed, so switching a
 * Sunday back on does not mean typing 12:00–16:00 again.
 */
export async function saveWeekday(input: {
  storeId: string;
  weekday: number;
  opensAt: string;
  closesAt: string;
  closed: boolean;
}): Promise<void> {
  if (input.weekday < 1 || input.weekday > 7) throw new Error("Weekday must be 1–7.");
  if (!isTimeString(input.opensAt) || !isTimeString(input.closesAt)) {
    throw new Error("Opening hours must be HH:mm.");
  }

  await prisma.storeOpeningHours.upsert({
    where: { storeId_weekday: { storeId: input.storeId, weekday: input.weekday } },
    create: input,
    update: {
      opensAt: input.opensAt,
      closesAt: input.closesAt,
      closed: input.closed,
    },
  });
}

export type OpeningExceptionRow = OpeningException & { id: string };

export async function listExceptions(
  storeId: string,
  range?: { from: string; to: string }
): Promise<OpeningExceptionRow[]> {
  return prisma.storeOpeningException.findMany({
    where: {
      storeId,
      ...(range ? { date: { gte: range.from, lte: range.to } } : {}),
    },
    orderBy: { date: "asc" },
    select: { id: true, date: true, closed: true, opensAt: true, closesAt: true, note: true },
  });
}

export async function exceptionsByStore(
  storeIds: string[],
  range: { from: string; to: string }
): Promise<Map<string, OpeningException[]>> {
  if (storeIds.length === 0) return new Map();

  const rows = await prisma.storeOpeningException.findMany({
    where: { storeId: { in: storeIds }, date: { gte: range.from, lte: range.to } },
    select: { storeId: true, date: true, closed: true, opensAt: true, closesAt: true, note: true },
  });

  const byStore = new Map<string, OpeningException[]>();
  for (const row of rows) {
    byStore.set(row.storeId, [...(byStore.get(row.storeId) ?? []), row]);
  }
  return byStore;
}

export async function saveException(input: {
  storeId: string;
  date: string;
  closed: boolean;
  opensAt: string | null;
  closesAt: string | null;
  note: string | null;
}): Promise<void> {
  if (!isDateString(input.date)) throw new Error("Exception date must be YYYY-MM-DD.");

  // A day that is open needs hours; a day that is closed must not carry any,
  // or the grid would show times for a shut shop.
  const open = !input.closed;
  if (open && (!isTimeString(input.opensAt ?? "") || !isTimeString(input.closesAt ?? ""))) {
    throw new Error("An open exception needs both times.");
  }

  const data = {
    closed: input.closed,
    opensAt: open ? input.opensAt : null,
    closesAt: open ? input.closesAt : null,
    note: input.note?.trim() || null,
  };

  await prisma.storeOpeningException.upsert({
    where: { storeId_date: { storeId: input.storeId, date: input.date } },
    create: { storeId: input.storeId, date: input.date, ...data },
    update: data,
  });
}

/** Scoped by store as well as id, so an id from elsewhere cannot be removed. */
export async function deleteException(storeId: string, id: string): Promise<void> {
  await prisma.storeOpeningException.deleteMany({ where: { id, storeId } });
}

/**
 * The resolved hours for a run of dates at one store — what the grid asks for.
 */
export async function effectiveHoursForRange(
  storeId: string,
  dates: string[]
): Promise<EffectiveHours[]> {
  if (dates.length === 0) return [];

  const [hours, exceptions] = await Promise.all([
    listOpeningHours(storeId),
    listExceptions(storeId, { from: dates[0], to: dates[dates.length - 1] }),
  ]);

  return dates.map((date) => effectiveHoursFor(date, hours, exceptions));
}

/** Which stores still have no weekly hours — reported on the admin page. */
export async function storeIdsWithoutHours(): Promise<string[]> {
  const [stores, withHours] = await Promise.all([
    prisma.store.findMany({ select: { id: true } }),
    prisma.storeOpeningHours.findMany({ distinct: ["storeId"], select: { storeId: true } }),
  ]);
  const configured = new Set(withHours.map((row) => row.storeId));
  return stores.filter((store) => !configured.has(store.id)).map((store) => store.id);
}
