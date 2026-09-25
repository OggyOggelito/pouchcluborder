import { ManualImportScheduleProvider } from "@/lib/schedule/manual-import-provider";
import { TooEasyApiScheduleProvider } from "@/lib/schedule/tooeasy-provider";
import type { ScheduleProvider } from "@/lib/schedule/types";

export type { DateRange, ScheduleProvider, ShiftEntry } from "@/lib/schedule/types";

/**
 * The single switch. `SCHEDULE_PROVIDER=manual` (the default) or `tooeasy`.
 * Nothing else in the codebase decides which backend is live.
 */
export function getScheduleProvider(): ScheduleProvider {
  const configured = (process.env.SCHEDULE_PROVIDER ?? "manual").toLowerCase();

  switch (configured) {
    case "tooeasy":
      return new TooEasyApiScheduleProvider();
    case "manual":
      return new ManualImportScheduleProvider();
    default:
      // An unknown value should not silently fall back to a different data
      // source than the one asked for.
      throw new Error(
        `Unknown SCHEDULE_PROVIDER "${configured}". Use "manual" or "tooeasy".`
      );
  }
}
