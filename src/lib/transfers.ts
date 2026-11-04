/**
 * Store-to-store transfers — a structured "can you spare two stockar of X?".
 *
 * Coordination only. A request reserves nothing: there is no stock count in
 * this app to reserve against, and the sending store decides what it can
 * actually spare.
 */

export const TRANSFER_STATUSES = [
  "REQUESTED",
  "ACCEPTED",
  "SENT",
  "RECEIVED",
  "DECLINED",
  "CANCELLED",
] as const;

export type TransferStatus = (typeof TRANSFER_STATUSES)[number];

export const TRANSFER_STATUS_LABELS: Record<TransferStatus, string> = {
  REQUESTED: "Efterfrågad",
  ACCEPTED: "Accepterad",
  SENT: "Skickad",
  RECEIVED: "Mottagen",
  DECLINED: "Nekad",
  CANCELLED: "Avbruten",
};

export const TRANSFER_UNITS = ["STOCK", "CAN"] as const;
export type TransferUnit = (typeof TRANSFER_UNITS)[number];

export const TRANSFER_UNIT_LABELS: Record<TransferUnit, string> = {
  STOCK: "stock",
  CAN: "dosa",
};

/** Shown wherever a transfer is created or accepted. */
export const NO_RESERVATION_NOTICE =
  "En förfrågan reserverar ingenting. Appen har inga lagersaldon — det är den skickande butiken som avgör vad den kan avvara.";

export function isTransferStatus(value: unknown): value is TransferStatus {
  return typeof value === "string" && (TRANSFER_STATUSES as readonly string[]).includes(value);
}

export function toTransferStatus(value: unknown): TransferStatus {
  return isTransferStatus(value) ? value : "REQUESTED";
}

export function toTransferUnit(value: unknown): TransferUnit {
  return value === "CAN" ? "CAN" : "STOCK";
}

/**
 * Which statuses a transfer may move to next.
 *
 * RECEIVED, DECLINED and CANCELLED are terminal. Anything not listed here is
 * rejected server-side, so a stale page cannot push a transfer backwards.
 */
export const ALLOWED_TRANSITIONS: Record<TransferStatus, TransferStatus[]> = {
  REQUESTED: ["ACCEPTED", "DECLINED", "CANCELLED"],
  ACCEPTED: ["SENT", "CANCELLED"],
  SENT: ["RECEIVED"],
  RECEIVED: [],
  DECLINED: [],
  CANCELLED: [],
};

export function canTransition(from: TransferStatus, to: TransferStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function isTerminal(status: TransferStatus): boolean {
  return ALLOWED_TRANSITIONS[status].length === 0;
}

/** Which side acts next — drives the button shown on the detail page. */
export type TransferActor = "REQUESTER" | "SENDER" | "NOBODY";

export function nextActor(status: TransferStatus): TransferActor {
  switch (status) {
    case "REQUESTED":
      return "SENDER";
    case "ACCEPTED":
      return "SENDER";
    case "SENT":
      return "REQUESTER";
    default:
      return "NOBODY";
  }
}

/**
 * Which stores may accept a transfer.
 *
 * A targeted request is for that store only. An open request goes to every
 * other store in the requesting store's region — never the requesting store
 * itself, and never outside the region unless an admin targeted it explicitly.
 */
export function eligibleAccepterIds(input: {
  requestingStoreId: string;
  targetStoreId: string | null;
  requestingRegion: string | null;
  stores: { id: string; region: string | null }[];
}): string[] {
  if (input.targetStoreId) return [input.targetStoreId];

  return input.stores
    .filter(
      (store) =>
        store.id !== input.requestingStoreId &&
        store.region !== null &&
        store.region === input.requestingRegion
    )
    .map((store) => store.id);
}
