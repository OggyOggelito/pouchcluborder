import type { DateRange, ScheduleProvider, ShiftEntry } from "@/lib/schedule/types";

/**
 * TooEasy WFM — NOT IMPLEMENTED.
 *
 * Deliberately a stub. We have no API documentation from TooEasy yet, and
 * guessing at endpoints or shipping a hand-written client for an undocumented
 * service would be worse than having nothing: it would look finished and fail
 * in production.
 *
 * TODO: implement `getShifts` once TooEasy confirms the following.
 *
 * 1. Base URL, and whether test and production differ.
 *      -> TOOEASY_BASE_URL
 * 2. Auth method. Most likely a bearer token or an API key header; if it is
 *    OAuth2 client-credentials we also need the token endpoint and a place to
 *    cache the token, since this runs per request.
 *      -> TOOEASY_API_KEY (and TOOEASY_TOKEN_URL / client id + secret for OAuth)
 * 3. The shift/roster endpoint: its path, whether the date range is passed as
 *    query parameters or a body, and its page size and paging style.
 * 4. How TooEasy identifies an employee, and how that maps to our `User`. If
 *    they key on something other than email we need to store their id on
 *    `User` (e.g. `tooEasyEmployeeId`) and map it here.
 * 5. How TooEasy identifies a location, and how that maps to our `Store`
 *    (likewise, probably a `tooEasyLocationId` on `Store`).
 * 6. Whether times come back as local wall-clock or UTC instants. `ShiftEntry`
 *    carries local wall-clock strings, so a UTC feed has to be converted in
 *    this class — not downstream.
 * 7. Rate limits, so we know whether to cache.
 *
 * Nothing outside this file needs to change when it lands: pages read through
 * `ScheduleProvider`, and `getScheduleProvider()` picks the implementation from
 * SCHEDULE_PROVIDER.
 */
export class TooEasyApiScheduleProvider implements ScheduleProvider {
  readonly name = "TooEasy WFM API (ej implementerad)";

  async getShifts(_userIds: string[], _range: DateRange): Promise<ShiftEntry[]> {
    throw new Error(
      "TooEasyApiScheduleProvider is not implemented yet — no API documentation. " +
        "Set SCHEDULE_PROVIDER=manual to use the CSV/ICS import."
    );
  }
}
