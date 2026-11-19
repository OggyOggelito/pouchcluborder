/**
 * Demo days.
 *
 * A supplier asks for a date in one, several or all stores; each store answers
 * for itself. One request is therefore several rows sharing a `groupId`, and a
 * group can come back half confirmed — which is the honest outcome when three
 * shops have three different weeks.
 *
 * Every rule here is a constant at the top of the file rather than a number
 * buried in a query, because all of them are judgement calls somebody will
 * want to change.
 *
 * Pure, so the booking rules are tested without a database.
 */
import { addDaysToDate, isDateString } from "@/lib/schedule/time";

/** How far ahead a supplier must ask. A demo day needs staff planning. */
export const MIN_LEAD_DAYS = 7;

/** How far ahead they may ask. Beyond this the rota does not exist yet. */
export const MAX_AHEAD_DAYS = 60;

/** How late a supplier may pull out without ringing somebody. */
export const CANCEL_CUTOFF_DAYS = 3;

/** About the demo. The form says not to write anything about a person. */
export const MAX_DEMO_NOTE_LENGTH = 300;

export const DEMO_STATUSES = [
  "REQUESTED",
  "CONFIRMED",
  "DECLINED",
  "CANCELLED_BY_SUPPLIER",
  "CANCELLED_BY_STORE",
] as const;

export type DemoStatus = (typeof DEMO_STATUSES)[number];

export const DEMO_STATUS_LABELS: Record<DemoStatus, string> = {
  REQUESTED: "Väntar på svar",
  CONFIRMED: "Bekräftad",
  DECLINED: "Nekad",
  CANCELLED_BY_SUPPLIER: "Avbokad av er",
  CANCELLED_BY_STORE: "Avbokad av butiken",
};

/** The same statuses, worded for staff rather than for the supplier. */
export const DEMO_STATUS_LABELS_STAFF: Record<DemoStatus, string> = {
  REQUESTED: "Väntar på svar",
  CONFIRMED: "Bekräftad",
  DECLINED: "Nekad",
  CANCELLED_BY_SUPPLIER: "Avbokad av leverantören",
  CANCELLED_BY_STORE: "Avbokad av butiken",
};

export function isDemoStatus(value: unknown): value is DemoStatus {
  return typeof value === "string" && (DEMO_STATUSES as readonly string[]).includes(value);
}

export function toDemoStatus(value: unknown): DemoStatus {
  return isDemoStatus(value) ? value : "REQUESTED";
}

/**
 * Which statuses hold a slot.
 *
 * A declined or cancelled booking frees the day for somebody else, so only
 * these two block. That is also why there is no unique constraint on
 * (store, date) in the schema — the rule is "at most one *live* demo day",
 * which a constraint cannot express.
 */
export const SLOT_HOLDING: DemoStatus[] = ["REQUESTED", "CONFIRMED"];

export function holdsSlot(status: DemoStatus): boolean {
  return SLOT_HOLDING.includes(status);
}

export const ALLOWED_TRANSITIONS: Record<DemoStatus, DemoStatus[]> = {
  REQUESTED: ["CONFIRMED", "DECLINED", "CANCELLED_BY_SUPPLIER", "CANCELLED_BY_STORE"],
  // A confirmed day can still fall through on either side — that is a phone
  // call in real life, and the portal should be able to record it.
  CONFIRMED: ["CANCELLED_BY_SUPPLIER", "CANCELLED_BY_STORE"],
  DECLINED: [],
  CANCELLED_BY_SUPPLIER: [],
  CANCELLED_BY_STORE: [],
};

export function canTransition(from: DemoStatus, to: DemoStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function isOpenRequest(status: DemoStatus): boolean {
  return status === "REQUESTED";
}

export type DateCheck = { ok: true } | { ok: false; error: string };

/**
 * May a supplier ask for this date at all?
 *
 * `today` is passed in rather than read from the clock, so the boundaries are
 * testable and so the caller decides which timezone "today" means.
 */
export function checkRequestDate(date: string, today: string): DateCheck {
  if (!isDateString(date)) return { ok: false, error: "Välj ett datum." };

  const earliest = addDaysToDate(today, MIN_LEAD_DAYS);
  const latest = addDaysToDate(today, MAX_AHEAD_DAYS);

  if (date < today) return { ok: false, error: "Datumet har passerat." };
  if (date < earliest) {
    return {
      ok: false,
      error: `Boka minst ${MIN_LEAD_DAYS} dagar i förväg. Tidigast ${earliest}.`,
    };
  }
  if (date > latest) {
    return {
      ok: false,
      error: `Boka högst ${MAX_AHEAD_DAYS} dagar i förväg. Senast ${latest}.`,
    };
  }
  return { ok: true };
}

/** The earliest and latest date the booking form offers. */
export function bookableRange(today: string): { from: string; to: string } {
  return { from: addDaysToDate(today, MIN_LEAD_DAYS), to: addDaysToDate(today, MAX_AHEAD_DAYS) };
}

/**
 * May the supplier still cancel?
 *
 * Inside the cut-off the booking stays, and the page says to ring the shop —
 * a demo day two days out is somebody's rota, and silently dropping it from a
 * screen does not tell them.
 */
export function canSupplierCancel(input: {
  status: DemoStatus;
  date: string;
  today: string;
}): boolean {
  if (!holdsSlot(input.status)) return false;
  return input.date >= addDaysToDate(input.today, CANCEL_CUTOFF_DAYS);
}

export type StoreOption = {
  storeId: string;
  storeName: string;
  /** Null when the store has no opening hours for that weekday at all. */
  opensAt: string | null;
  closesAt: string | null;
  /** Why the store cannot be picked, or null when it can. */
  blockedReason: string | null;
};

/**
 * Which stores a supplier may pick for a date, and why not.
 *
 * "Redan bokad" is deliberately all a blocked store says. Naming the brand
 * that holds the day would tell one supplier what another is doing, and the
 * supplier does not need to know who — only that the day is taken.
 */
export function storeOptionsFor(input: {
  stores: {
    storeId: string;
    storeName: string;
    closed: boolean;
    hoursMissing: boolean;
    opensAt: string | null;
    closesAt: string | null;
    taken: boolean;
  }[];
}): StoreOption[] {
  return input.stores.map((store) => ({
    storeId: store.storeId,
    storeName: store.storeName,
    opensAt: store.opensAt,
    closesAt: store.closesAt,
    blockedReason: store.taken
      ? "Redan bokad"
      : store.closed
        ? "Stängt den dagen"
        : store.hoursMissing
          ? "Öppettider saknas"
          : null,
  }));
}

export function bookableStores(options: StoreOption[]): StoreOption[] {
  return options.filter((option) => option.blockedReason === null);
}

/** Shown under the note field on the booking form. */
export const DEMO_NOTE_NOTICE = "Skriv inte personuppgifter om kunder.";
