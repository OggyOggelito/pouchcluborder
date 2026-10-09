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
  /** From our own User record — never anything TooEasy returned. */
  email: string;
  phone: string | null;
  storeNames: string[];
};

export type ScheduleDay = { key: string; date: Date };

export type ShiftCell = { storeName: string; startTime: string; endTime: string };

/**
 * A fetch either succeeded or failed. Pages must be able to tell "nobody is
 * scheduled" from "we could not reach the schedule", because showing an empty
 * grid for an outage reads as everyone being off.
 */
export type ScheduleOutcome<T> =
  | { ok: true; data: T; providerName: string }
  | { ok: false; error: string; providerName: string };

export type MySchedule = { entries: (ShiftEntry & { storeName: string })[] };

export type TeamSchedule = {
  regions: string[];
  days: ScheduleDay[];
  members: TeamMember[];
  /** `${userId}|${dayKey}` -> that person's shifts that day. */
  shiftsByUserDay: Map<string, ShiftCell[]>;
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

/** Never leak a stack or a URL into the UI — a short sentence is enough. */
function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Okänt fel.";
  return message.replace(/https?:\/\/\S+/g, "(url)");
}

/** One person's own upcoming shifts. */
export async function getMyShifts(
  userId: string,
  options: { skipCache?: boolean } = {}
): Promise<ScheduleOutcome<MySchedule>> {
  const provider = getScheduleProvider();
  const start = startOfToday();

  try {
    const entries = await provider.getShifts(
      [userId],
      { from: start, to: addDays(start, SCHEDULE_DAYS - 1) },
      options
    );
    const storeNames = await storeNameMap(entries.map((entry) => entry.storeId));

    return {
      ok: true,
      providerName: provider.name,
      data: {
        entries: entries
          .map((entry) => ({
            ...entry,
            storeName: storeNames.get(entry.storeId) ?? "Okänd butik",
          }))
          .sort(
            (a, b) =>
              a.date.getTime() - b.date.getTime() || a.startTime.localeCompare(b.startTime)
          ),
      },
    };
  } catch (error) {
    return { ok: false, error: describeError(error), providerName: provider.name };
  }
}

/**
 * Coverage across the manager's region.
 *
 * Scope is decided here, on the server, from the signed-in user's own record —
 * never from anything the request supplies. An ADMIN sees every region; an
 * OWNER sees only the regions of the stores granted to them in StoreAccess,
 * and cannot reach another region by any means the UI offers or omits.
 */
export async function getTeamSchedule(
  user: UserRecord,
  options: { skipCache?: boolean } = {}
): Promise<ScheduleOutcome<TeamSchedule>> {
  const provider = getScheduleProvider();
  const days = scheduleDays();
  const isAdmin = canAccessAllStores(user.role);

  const regions = await regionsForUser(user);

  const storesInScope = await prisma.store.findMany({
    where: isAdmin ? {} : { region: { in: regions } },
    select: { id: true, name: true },
  });
  const storeNames = new Map(storesInScope.map((store) => [store.id, store.name]));

  const access = await prisma.storeAccess.findMany({
    where: { storeId: { in: storesInScope.map((store) => store.id) } },
    select: {
      store: { select: { name: true } },
      user: { select: { id: true, name: true, email: true, phone: true } },
    },
  });

  const byUser = new Map<string, TeamMember>();
  for (const row of access) {
    const existing = byUser.get(row.user.id);
    if (existing) {
      if (!existing.storeNames.includes(row.store.name)) existing.storeNames.push(row.store.name);
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

  try {
    const entries = await provider.getShifts(
      members.map((member) => member.id),
      { from: days[0].date, to: days[days.length - 1].date },
      options
    );

    const shiftsByUserDay = new Map<string, ShiftCell[]>();
    for (const entry of entries) {
      // Defence in depth: a shift at a store outside this manager's scope is
      // dropped even if the provider returned it.
      const storeName = storeNames.get(entry.storeId);
      if (!storeName) continue;

      const key = `${entry.userId}|${dayKey(entry.date)}`;
      const list = shiftsByUserDay.get(key) ?? [];
      list.push({ storeName, startTime: entry.startTime, endTime: entry.endTime });
      shiftsByUserDay.set(key, list);
    }

    return {
      ok: true,
      providerName: provider.name,
      data: { regions, days, members, shiftsByUserDay },
    };
  } catch (error) {
    return { ok: false, error: describeError(error), providerName: provider.name };
  }
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

  // A store with no region falls back to its own name, so nobody silently
  // disappears from the grid.
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
