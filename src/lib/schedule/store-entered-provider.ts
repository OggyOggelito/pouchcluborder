import { prisma } from "@/lib/db";
import { toDateString, toUtcDate } from "@/lib/schedule/time";
import type {
  DateRange,
  GetShiftsOptions,
  ScheduleProvider,
  ShiftEntry,
} from "@/lib/schedule/types";

/**
 * The working path: the schedule each store typed into the portal.
 *
 * TooEasy WFM never gave us API access, so the plan changed — owners enter
 * their own staff's shifts and nearby stores can see who is free. This reads
 * those shifts back through the same interface a live API would use, so
 * "Mitt schema" and the Idag card did not have to learn anything new.
 *
 * Shifts belong to an `Employee`, and most employees have no portal account.
 * `ScheduleProvider` is keyed by user, so this returns only the shifts of
 * employees who are linked to one — which is exactly what "my shifts" means.
 */
export class StoreEnteredScheduleProvider implements ScheduleProvider {
  readonly name = "Butikernas egna schema";

  // `options` is accepted for interface parity. There is no upstream to
  // bypass: the data is ours and a read is a local query.
  async getShifts(
    userIds: string[],
    range: DateRange,
    _options: GetShiftsOptions = {}
  ): Promise<ShiftEntry[]> {
    if (userIds.length === 0) return [];

    // Dates are stored as "2026-11-04", so the range compares as text. ISO
    // dates sort chronologically, which is half the reason to store them.
    const shifts = await prisma.scheduleShift.findMany({
      where: {
        employee: { userId: { in: userIds } },
        date: { gte: toDateString(range.from), lte: toDateString(range.to) },
      },
      orderBy: [{ date: "asc" }, { startsAt: "asc" }],
      select: {
        storeId: true,
        date: true,
        startsAt: true,
        endsAt: true,
        employee: { select: { userId: true } },
      },
    });

    return shifts.flatMap((shift) =>
      shift.employee.userId
        ? [
            {
              userId: shift.employee.userId,
              storeId: shift.storeId,
              date: toUtcDate(shift.date),
              startTime: shift.startsAt,
              endTime: shift.endsAt,
            },
          ]
        : []
    );
  }
}
