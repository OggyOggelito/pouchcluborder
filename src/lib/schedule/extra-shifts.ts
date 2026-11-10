/**
 * "Extrapass" — borrowing somebody from another shop, as a record rather than
 * a phone call that nobody else heard.
 *
 * The asking store picks a free person and the times. The person's own store
 * decides, because they are that store's staff — an extra shift is not
 * something another manager can help themselves to.
 *
 * Pure; the transitions are tested on their own and the repository refuses
 * anything this file does not allow.
 */

export const EXTRA_SHIFT_STATUSES = ["REQUESTED", "ACCEPTED", "DECLINED", "CANCELLED"] as const;

export type ExtraShiftStatus = (typeof EXTRA_SHIFT_STATUSES)[number];

export const EXTRA_SHIFT_STATUS_LABELS: Record<ExtraShiftStatus, string> = {
  REQUESTED: "Väntar på svar",
  ACCEPTED: "Accepterad",
  DECLINED: "Nekad",
  CANCELLED: "Återkallad",
};

/** About the work — "lagerinventering", "leverans" — not about the person. */
export const MAX_EXTRA_SHIFT_NOTE_LENGTH = 200;

export function isExtraShiftStatus(value: unknown): value is ExtraShiftStatus {
  return typeof value === "string" && (EXTRA_SHIFT_STATUSES as readonly string[]).includes(value);
}

export function toExtraShiftStatus(value: unknown): ExtraShiftStatus {
  return isExtraShiftStatus(value) ? value : "REQUESTED";
}

/**
 * Where a request may go next. The three end states are final — a declined
 * request is asked again as a new one, so the timeline stays readable.
 */
export const ALLOWED_TRANSITIONS: Record<ExtraShiftStatus, ExtraShiftStatus[]> = {
  REQUESTED: ["ACCEPTED", "DECLINED", "CANCELLED"],
  ACCEPTED: [],
  DECLINED: [],
  CANCELLED: [],
};

export function canTransition(from: ExtraShiftStatus, to: ExtraShiftStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function isOpenRequest(status: ExtraShiftStatus): boolean {
  return status === "REQUESTED";
}

/**
 * Which side acts next.
 *
 * HOME is the employee's own store: it accepts or declines. ASKING is the
 * store that sent it, which may only withdraw.
 */
export type ExtraShiftActor = "HOME" | "ASKING" | "NOBODY";

export function nextActor(status: ExtraShiftStatus): ExtraShiftActor {
  return status === "REQUESTED" ? "HOME" : "NOBODY";
}

export const EXTRA_SHIFT_TABS = ["incoming", "outgoing", "history"] as const;
export type ExtraShiftTab = (typeof EXTRA_SHIFT_TABS)[number];

export const EXTRA_SHIFT_TAB_LABELS: Record<ExtraShiftTab, string> = {
  incoming: "Inkomna",
  outgoing: "Skickade",
  history: "Historik",
};

export function toExtraShiftTab(value: unknown): ExtraShiftTab {
  return (EXTRA_SHIFT_TABS as readonly string[]).includes(String(value))
    ? (value as ExtraShiftTab)
    : "incoming";
}

/** Shown wherever a request is made or answered. */
export const EXTRA_SHIFT_NOTICE =
  "Det är medarbetarens egen butik som svarar. Vid ett ja läggs passet in hos er automatiskt.";

/**
 * Why an accept failed. The one case worth its own message: the person picked
 * up something else between the request going out and the answer coming back.
 */
export const DOUBLE_BOOKED_MESSAGE =
  "Medarbetaren har fått ett annat pass som krockar med tiderna. Passet lades inte in.";
