import { prisma } from "@/lib/db";
import type {
  DateRange,
  GetShiftsOptions,
  ScheduleProvider,
  ShiftEntry,
} from "@/lib/schedule/types";

/**
 * Reads the shifts put into our own database by the admin CSV/ICS upload.
 *
 * Dormant. It was the working path while we were waiting on TooEasy's API, and
 * it still works — `SCHEDULE_PROVIDER=import` selects it — but the stores now
 * type their own schedule into the portal and `manual` means
 * `StoreEnteredScheduleProvider`. Kept because an upload is still the quickest
 * way to get a roster out of another tool and into this one.
 */
export class ManualImportScheduleProvider implements ScheduleProvider {
  readonly name = "Manuell import (CSV/ICS)";

  // `options` is accepted for interface parity; this provider reads our own
  // database, so there is no upstream cache to bypass.
  async getShifts(
    userIds: string[],
    range: DateRange,
    _options: GetShiftsOptions = {}
  ): Promise<ShiftEntry[]> {
    if (userIds.length === 0) return [];

    const shifts = await prisma.shift.findMany({
      where: {
        userId: { in: userIds },
        date: { gte: range.from, lte: range.to },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      select: {
        userId: true,
        storeId: true,
        date: true,
        startTime: true,
        endTime: true,
      },
    });

    return shifts;
  }
}
