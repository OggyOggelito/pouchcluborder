import "server-only";
import { prisma } from "@/lib/db";
import { getScheduleProvider } from "@/lib/schedule";
import type { ShiftEntry } from "@/lib/schedule/types";
import { addDays, startOfToday } from "@/lib/repositories/shifts";
import type { UserRecord } from "@/lib/repositories/users";
import { canAccessAllStores } from "@/lib/roles";

export const SCHEDULE_DAYS = 14;

export type TeamMember = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  storeNames: string[];
};

export type ScheduleDay = {
  /** "2026-09-25" */
  key: string;
  date: Date;
};

export type TeamSchedule = {
  regions: string[];
  days: ScheduleDay[];
  members: TeamMember[];
  /** `${userId}|${dayKey}` -> the shifts that person has that day. */
  shiftsByUserDay: Map<string, { storeName: string; startTime: string; endTime: string }[]>;
  providerName: string;
};

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function scheduleDays(count = SCHEDULE_DAYS): ScheduleDay[] {
  const start = startOfToday();
  return Array.from({ length: count }, (_, offset) => {
    const date = addDays(start, offset);
    return { key: dayKey(date), date };
  });
}

/** One person's own upcoming shifts, read through the provider. */
export async function getMyShifts(
  userId: string
): Promise<{ entries: (ShiftEntry & { storeName: string })[]; providerName: string }> {
  const provider = getScheduleProvider();
  const start = startOfToday();

  const entries = await provider.getShifts([userId], {
    from: start,
    to: addDays(start, SCHEDULE_DAYS - 1),
  });

  const storeNames = await storeNameMap(entries.map((entry) => entry.storeId));

  return {
    providerName: provider.name,
    entries: entries.map((entry) => ({
      ...entry,
      storeName: storeNames.get(entry.storeId) ?? "Okänd butik",
    })),
  };
}

/**
 * Coverage across the manager's region.
 *
 * An ADMIN sees every region; an OWNER sees the regions of the stores they
 * hold. A store with no region set is treated as its own region rather than
 * being dropped, so nobody silently disappears from the grid.
 */
export async function getTeamSchedule(user: UserRecord): Promise<TeamSchedule> {
  const provider = getScheduleProvider();
  const days = scheduleDays();

  const regions = await regionsForUser(user);

  const storesInRegion = await prisma.store.findMany({
    where: canAccessAllStores(user.role) ? {} : { region: { in: regions } },
    select: { id: true, name: true, region: true },
  });
  const storeNames = new Map(storesInRegion.map((store) => [store.id, store.name]));
  const storeIds = storesInRegion.map((store) => store.id);

  const access = await prisma.storeAccess.findMany({
    where: { storeId: { in: storeIds } },
    select: {
      store: { select: { name: true } },
      user: { select: { id: true, name: true, email: true, phone: true } },
    },
  });

  const byUser = new Map<string, TeamMember>();
  for (const row of access) {
    const existing = byUser.get(row.user.id);
    if (existing) {
      existing.storeNames.push(row.store.name);
      continue;
    }
    byUser.set(row.user.id, {
      id: row.user.id,
      name: row.user.name,
      email: row.user.email,
      phone: row.user.phone,
      storeNames: [row.store.name],
    });
  }

  const members = [...byUser.values()].sort((a, b) =>
    (a.name ?? a.email).localeCompare(b.name ?? b.email, "sv")
  );

  const entries = await provider.getShifts(
    members.map((member) => member.id),
    { from: days[0].date, to: days[days.length - 1].date }
  );

  const shiftsByUserDay = new Map<
    string,
    { storeName: string; startTime: string; endTime: string }[]
  >();
  for (const entry of entries) {
    const key = `${entry.userId}|${dayKey(entry.date)}`;
    const list = shiftsByUserDay.get(key) ?? [];
    list.push({
      storeName: storeNames.get(entry.storeId) ?? "—",
      startTime: entry.startTime,
      endTime: entry.endTime,
    });
    shiftsByUserDay.set(key, list);
  }

  return { regions, days, members, shiftsByUserDay, providerName: provider.name };
}

async function regionsForUser(user: UserRecord): Promise<string[]> {
  if (canAccessAllStores(user.role)) {
    const all = await prisma.store.findMany({
      where: { region: { not: null } },
      select: { region: true },
      distinct: ["region"],
    });
    return all.map((store) => store.region!).sort();
  }

  const stores = await prisma.store.findMany({
    where: { id: { in: user.stores.map((store) => store.id) } },
    select: { region: true, name: true },
  });

  // Fall back to the store's own name so an unassigned store still groups.
  return [...new Set(stores.map((store) => store.region ?? store.name))].sort();
}

async function storeNameMap(storeIds: string[]): Promise<Map<string, string>> {
  if (storeIds.length === 0) return new Map();
  const stores = await prisma.store.findMany({
    where: { id: { in: [...new Set(storeIds)] } },
    select: { id: true, name: true },
  });
  return new Map(stores.map((store) => [store.id, store.name]));
}
