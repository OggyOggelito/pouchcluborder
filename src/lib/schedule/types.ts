/**
 * The only shape the schedule UI knows about.
 *
 * Every page reads shifts through `ScheduleProvider`, so swapping the manual
 * import for a live TooEasy WFM API later is a config change and a new class —
 * no component touches a vendor.
 */
export type ShiftEntry = {
  userId: string;
  storeId: string;
  /** Local calendar date at midnight UTC. */
  date: Date;
  /** Local wall-clock, "07:30". */
  startTime: string;
  endTime: string;
};

export type DateRange = {
  /** Inclusive. */
  from: Date;
  /** Inclusive. */
  to: Date;
};

export interface ScheduleProvider {
  /** Name shown in the admin UI so it is obvious which one is live. */
  readonly name: string;
  /** Shifts for these users in this range. An empty userIds list returns []. */
  getShifts(userIds: string[], range: DateRange): Promise<ShiftEntry[]>;
}
