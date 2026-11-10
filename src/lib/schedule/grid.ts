/**
 * The shapes the week grid is rendered from.
 *
 * Kept apart from src/lib/repositories/schedule-week.ts, which builds them,
 * because that module reaches for Prisma and the grid is a client component.
 * A type-only import would be erased, but the boundary is clearer as a file:
 * everything here is plain data that has already left the database.
 */
import type { Coverage, EffectiveHours, ShiftTemplate } from "@/lib/schedule/opening-hours";
import type { ScheduleWarning } from "@/lib/schedule/week";

export type WeekShift = {
  id: string;
  employeeId: string;
  employeeName: string;
  startsAt: string;
  endsAt: string;
  note: string | null;
  /** Came out of an accepted extra-shift request. */
  isExtra: boolean;
};

export type WeekRowEmployee = {
  id: string;
  name: string;
  /** False for somebody borrowed from another store this week. */
  own: boolean;
  homeStoreName: string;
};

export type WeekDay = {
  date: string;
  hours: EffectiveHours;
  coverage: Coverage;
  coverageText: string;
  warnings: ScheduleWarning[];
  templates: ShiftTemplate[];
  shifts: WeekShift[];
};

export type ChangeRow = {
  id: string;
  type: string;
  detail: string | null;
  at: Date;
  byName: string | null;
};

export const CHANGE_TYPE_LABELS: Record<string, string> = {
  CREATED: "Pass inlagt",
  UPDATED: "Pass ändrat",
  DELETED: "Pass borttaget",
  DAY_OFF: "Markerad ledig",
  COPIED_WEEK: "Vecka kopierad",
  COPIED_DAY: "Dag kopierad",
  EXTRA_SHIFT: "Extrapass inlagt",
};

export function changeLabel(type: string): string {
  return CHANGE_TYPE_LABELS[type] ?? type;
}

export type ScheduleWeek = {
  store: { id: string; name: string };
  monday: string;
  weekKey: string;
  weekNumber: number;
  dates: string[];
  buffer: number;
  days: WeekDay[];
  employees: WeekRowEmployee[];
  changes: ChangeRow[];
};
