/**
 * Problem reports — damaged goods, a wrong price label, broken equipment, a
 * delivery that went wrong.
 *
 * The point is that a report takes under a minute to file: pick a category,
 * type a sentence, send. Everything else is the admin queue's job.
 */

export const ISSUE_CATEGORIES = [
  "DAMAGED_GOODS",
  "PRICE_OR_LABEL",
  "EQUIPMENT",
  "DELIVERY",
  "OTHER",
] as const;

export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

export const ISSUE_CATEGORY_LABELS: Record<IssueCategory, string> = {
  DAMAGED_GOODS: "Skadad vara",
  PRICE_OR_LABEL: "Fel pris eller etikett",
  EQUIPMENT: "Trasig utrustning",
  DELIVERY: "Leveransproblem",
  OTHER: "Övrigt",
};

export const ISSUE_CATEGORY_HELP: Record<IssueCategory, string> = {
  DAMAGED_GOODS: "Krossade dosor, trasig kartong, läckage.",
  PRICE_OR_LABEL: "Hyllpris eller etikett stämmer inte.",
  EQUIPMENT: "Kyl, kassa, skrivare, larm.",
  DELIVERY: "Saknas, fel antal, kom inte fram.",
  OTHER: "Något annat som behöver fixas.",
};

export const ISSUE_STATUSES = ["NEW", "IN_PROGRESS", "RESOLVED"] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const ISSUE_STATUS_LABELS: Record<IssueStatus, string> = {
  NEW: "Ny",
  IN_PROGRESS: "Pågår",
  RESOLVED: "Löst",
};

/** NEW and IN_PROGRESS are what the queue counts as outstanding. */
export function isOpenStatus(status: IssueStatus): boolean {
  return status !== "RESOLVED";
}

/**
 * Which statuses a report may move to.
 *
 * RESOLVED is reopenable: a fixed fridge breaks again, and a report that was
 * closed too early is the most likely thing to need reopening. It reopens to
 * IN_PROGRESS rather than NEW, because nothing can become unseen again — NEW
 * means "nobody has looked at this yet", and once someone has, that is no
 * longer true.
 */
export const ALLOWED_ISSUE_TRANSITIONS: Record<IssueStatus, IssueStatus[]> = {
  NEW: ["IN_PROGRESS", "RESOLVED"],
  IN_PROGRESS: ["RESOLVED"],
  RESOLVED: ["IN_PROGRESS"],
};

export function canTransitionIssue(from: IssueStatus, to: IssueStatus): boolean {
  return ALLOWED_ISSUE_TRANSITIONS[from].includes(to);
}

export const ISSUE_EVENT_TYPES = ["CREATED", "STATUS", "ASSIGNED", "COMMENT"] as const;
export type IssueEventType = (typeof ISSUE_EVENT_TYPES)[number];

/** Free text, long enough to describe a problem and no longer. */
export const MAX_ISSUE_TEXT_LENGTH = 1000;
export const MAX_COMMENT_LENGTH = 1000;

export function isIssueCategory(value: unknown): value is IssueCategory {
  return typeof value === "string" && (ISSUE_CATEGORIES as readonly string[]).includes(value);
}

export function toIssueCategory(value: unknown): IssueCategory {
  return isIssueCategory(value) ? value : "OTHER";
}

export function isIssueStatus(value: unknown): value is IssueStatus {
  return typeof value === "string" && (ISSUE_STATUSES as readonly string[]).includes(value);
}

export function toIssueStatus(value: unknown): IssueStatus {
  return isIssueStatus(value) ? value : "NEW";
}

export function clampIssueText(value: string | null | undefined, max = MAX_ISSUE_TEXT_LENGTH): string {
  if (!value) return "";
  return value.trim().slice(0, max);
}
