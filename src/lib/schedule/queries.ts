import "server-only";
import { prisma } from "@/lib/db";
import { getScheduleProvider } from "@/lib/schedule";
import type { ShiftEntry } from "@/lib/schedule/types";
import { addDays, startOfToday } from "@/lib/repositories/shifts";

export const SCHEDULE_DAYS = 14;

/**
 * One person's own shifts, read through `ScheduleProvider`.
 *
 * This is what the Idag card shows, and it is the only place left that goes
 * through the provider rather than straight at the stores' own schedule. That
 * is the point of it: whichever backend is configured, "ditt pass idag" comes
 * from the live one.
 *
 * The region coverage grid that used to live here is gone — the schedule is
 * entered by the stores now, so `/store/schedule` reads the week directly and
 * `/schedule/available` answers "who is free" without needing everybody's
 * hours. Nothing in the TooEasy integration was touched.
 */
export type ScheduleOutcome<T> =
  | { ok: true; data: T; providerName: string }
  | { ok: false; error: string; providerName: string };

export type MySchedule = { entries: (ShiftEntry & { storeName: string })[] };

/** Never leak a stack or a URL into the UI — a short sentence is enough. */
function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Okänt fel.";
  return message.replace(/https?:\/\/\S+/g, "(url)");
}

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

async function storeNameMap(storeIds: string[]): Promise<Map<string, string>> {
  if (storeIds.length === 0) return new Map();
  const stores = await prisma.store.findMany({
    where: { id: { in: [...new Set(storeIds)] } },
    select: { id: true, name: true },
  });
  return new Map(stores.map((store) => [store.id, store.name]));
}
