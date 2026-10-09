import "server-only";

/**
 * In-memory health of the schedule backend, for the /admin/tooeasy panel.
 * Process-local and deliberately tiny — it is a diagnostic, not a log.
 *
 * Only a message is kept from an error. Never a token, never a credential,
 * never a payload.
 */
export type ScheduleStatus = {
  lastSuccessAt: number | null;
  lastErrorAt: number | null;
  lastErrorMessage: string | null;
  lastFetchCount: number | null;
};

const status: ScheduleStatus = {
  lastSuccessAt: null,
  lastErrorAt: null,
  lastErrorMessage: null,
  lastFetchCount: null,
};

export function recordSuccess(entryCount: number): void {
  status.lastSuccessAt = Date.now();
  status.lastFetchCount = entryCount;
}

export function recordError(error: unknown): void {
  status.lastErrorAt = Date.now();
  status.lastErrorMessage =
    error instanceof Error ? error.message : "Okänt fel vid hämtning.";
}

export function getScheduleStatus(): ScheduleStatus {
  return { ...status };
}
