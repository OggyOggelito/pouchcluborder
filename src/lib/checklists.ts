/**
 * Checklist types and the pure helpers around them.
 *
 * A string rather than a Prisma enum, like roles, so a fifth type needs no
 * migration.
 */
export const CHECKLIST_TYPES = [
  "ONBOARDING",
  "STORE_OPENING",
  "DAILY_OPEN",
  "DAILY_CLOSE",
] as const;

export type ChecklistType = (typeof CHECKLIST_TYPES)[number];

export const CHECKLIST_TYPE_LABELS: Record<ChecklistType, string> = {
  ONBOARDING: "Introduktion",
  STORE_OPENING: "Nyöppning av butik",
  DAILY_OPEN: "Öppning",
  DAILY_CLOSE: "Stängning",
};

export const CHECKLIST_TYPE_DESCRIPTIONS: Record<ChecklistType, string> = {
  ONBOARDING: "Tilldelas en person av en administratör. Körs en gång.",
  STORE_OPENING: "En körning per butik, för en nyöppning.",
  DAILY_OPEN: "En körning per butik och dag, skapas när någon öppnar listan.",
  DAILY_CLOSE: "En körning per butik och dag, skapas när någon öppnar listan.",
};

export function isChecklistType(value: unknown): value is ChecklistType {
  return typeof value === "string" && (CHECKLIST_TYPES as readonly string[]).includes(value);
}

export function toChecklistType(value: unknown): ChecklistType {
  return isChecklistType(value) ? value : "DAILY_OPEN";
}

/** The daily types get one run per store per day; the others do not. */
export function isDailyType(type: ChecklistType): boolean {
  return type === "DAILY_OPEN" || type === "DAILY_CLOSE";
}

/** Store-scoped types need a storeId; ONBOARDING needs a userId. */
export function isStoreScoped(type: ChecklistType): boolean {
  return type !== "ONBOARDING";
}

/**
 * Today's date in Europe/Stockholm as "YYYY-MM-DD".
 *
 * Deliberately not UTC: a closing checklist worked at 23:30 local in summer is
 * already "tomorrow" in UTC, which would open a second run and split the day's
 * work across two lists.
 */
export function stockholmDateKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export type RunProgress = { done: number; total: number; requiredDone: number; requiredTotal: number };

export function progressOf(
  items: { checkedAt: Date | null; required: boolean }[]
): RunProgress {
  const required = items.filter((item) => item.required);
  return {
    done: items.filter((item) => item.checkedAt !== null).length,
    total: items.length,
    requiredDone: required.filter((item) => item.checkedAt !== null).length,
    requiredTotal: required.length,
  };
}

/** A run counts as complete when every required item is ticked. */
export function isComplete(progress: RunProgress): boolean {
  return progress.requiredTotal > 0 && progress.requiredDone === progress.requiredTotal;
}

/**
 * Internal links only. A checklist item must not be able to send staff to an
 * arbitrary external site, so anything that is not a site-relative path is
 * dropped.
 */
export function safeInternalLink(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  return trimmed;
}
