import { prisma } from "@/lib/db";
import type { DateRange, ScheduleProvider, ShiftEntry } from "@/lib/schedule/types";

/**
 * Reads the shifts put into our own database by the admin CSV/ICS upload.
 *
 * This is the working path today: whatever TooEasy (or any other scheduling
 * tool) can export gets uploaded on whatever cadence, and everything downstream
 * reads it through the same interface a live API would use.
 */
export class ManualImportScheduleProvider implements ScheduleProvider {
  readonly name = "Manuell import (CSV/ICS)";

  async getShifts(userIds: string[], range: DateRange): Promise<ShiftEntry[]> {
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
