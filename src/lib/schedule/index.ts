import { ManualImportScheduleProvider } from "@/lib/schedule/manual-import-provider";
import { StoreEnteredScheduleProvider } from "@/lib/schedule/store-entered-provider";
import { TooEasyApiScheduleProvider } from "@/lib/schedule/tooeasy-provider";
import type { ScheduleProvider } from "@/lib/schedule/types";

export type {
  DateRange,
  GetShiftsOptions,
  ScheduleProvider,
  ShiftEntry,
} from "@/lib/schedule/types";

/**
 * The single switch. Nothing else in the codebase decides which backend is
 * live.
 *
 * | value               | reads                                            |
 * | ------------------- | ------------------------------------------------ |
 * | `manual` (default)  | the schedule the stores type in themselves       |
 * | `import`            | shifts uploaded as CSV/ICS at `/admin/schedule`  |
 * | `tooeasy`           | the TooEasy WFM API                              |
 *
 * `manual` used to mean the CSV upload. It now means the portal's own
 * Teamschema, which is what "manual" means to everybody who uses the app —
 * the upload path keeps working under `import`, and the TooEasy client is
 * untouched and dormant. Nothing was deleted; see README.
 */
export function getScheduleProvider(): ScheduleProvider {
  const configured = (process.env.SCHEDULE_PROVIDER ?? "manual").toLowerCase();

  switch (configured) {
    case "tooeasy":
      return new TooEasyApiScheduleProvider();
    case "import":
      return new ManualImportScheduleProvider();
    case "manual":
      return new StoreEnteredScheduleProvider();
    default:
      // An unknown value should not silently fall back to a different data
      // source than the one asked for.
      throw new Error(
        `Unknown SCHEDULE_PROVIDER "${configured}". Use "manual", "import" or "tooeasy".`
      );
  }
}

/** True while the portal's own schedule is the live one. */
export function scheduleIsStoreEntered(): boolean {
  return (process.env.SCHEDULE_PROVIDER ?? "manual").toLowerCase() === "manual";
}

/** True while the dormant TooEasy integration is switched on. */
export function tooEasyIsActive(): boolean {
  return (process.env.SCHEDULE_PROVIDER ?? "manual").toLowerCase() === "tooeasy";
}
