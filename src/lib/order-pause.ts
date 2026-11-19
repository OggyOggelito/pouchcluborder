/**
 * Pausing ordering.
 *
 * A pause is a window, not a switch. It has a start, an optional end and a
 * message, and lifting it records when rather than deleting the row — so
 * "varför gick det inte att beställa i tisdags" has an answer.
 *
 * Pure, so the window arithmetic can be tested without a database or a clock.
 */
export const PAUSE_SCOPES = ["ALL", "STORE", "BRAND"] as const;
export type PauseScope = (typeof PAUSE_SCOPES)[number];

export const PAUSE_SCOPE_LABELS: Record<PauseScope, string> = {
  ALL: "Alla butiker",
  STORE: "En butik",
  BRAND: "Ett varumärke",
};

/** Long enough for "leverantörsbyte, åter 1 dec", short enough to read. */
export const MAX_PAUSE_MESSAGE = 200;

export function isPauseScope(value: unknown): value is PauseScope {
  return typeof value === "string" && (PAUSE_SCOPES as readonly string[]).includes(value);
}

export function toPauseScope(value: unknown): PauseScope {
  return isPauseScope(value) ? value : "ALL";
}

export type PauseRow = {
  id: string;
  scope: PauseScope;
  storeId: string | null;
  brandId: string | null;
  brandName: string | null;
  storeName: string | null;
  startsAt: Date;
  endsAt: Date | null;
  liftedAt: Date | null;
  message: string;
};

/**
 * Is this pause in force right now?
 *
 * Lifted beats everything, then the window. An open-ended pause (`endsAt`
 * null) runs until somebody lifts it, which is what a pause usually is.
 */
export function isActive(pause: PauseRow, now: Date = new Date()): boolean {
  if (pause.liftedAt !== null) return false;
  if (pause.startsAt.getTime() > now.getTime()) return false;
  if (pause.endsAt === null) return true;
  return pause.endsAt.getTime() > now.getTime();
}

/** Scheduled, but not started yet — shown as "pausas från …". */
export function isScheduled(pause: PauseRow, now: Date = new Date()): boolean {
  return pause.liftedAt === null && pause.startsAt.getTime() > now.getTime();
}

/**
 * Which pauses apply to this order.
 *
 * `ALL` catches everything. `STORE` catches one shop. `BRAND` catches an
 * order only if it actually contains that brand — a pause on one supplier
 * must not stop a store ordering everything else.
 */
export function pausesFor(input: {
  pauses: PauseRow[];
  storeId: string;
  /** Brands present in the order. Empty when asking "is ordering paused at all". */
  brandIds?: string[];
  now?: Date;
}): PauseRow[] {
  const now = input.now ?? new Date();
  const brandIds = new Set(input.brandIds ?? []);

  return input.pauses.filter((pause) => {
    if (!isActive(pause, now)) return false;
    switch (pause.scope) {
      case "ALL":
        return true;
      case "STORE":
        return pause.storeId === input.storeId;
      case "BRAND":
        // With no basket to check, a brand pause is reported as applying: the
        // store should see the banner before it starts picking products.
        return brandIds.size === 0 || (pause.brandId !== null && brandIds.has(pause.brandId));
    }
  });
}

const DATE = new Intl.DateTimeFormat("sv-SE", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Stockholm",
});

/**
 * "1 dec", not "1 dec.".
 *
 * sv-SE abbreviates with a full stop, which then collides with the colon that
 * introduces the message: "pausade till 1 dec.: Leverantörsbyte". The date is
 * always followed by punctuation here, so the dot goes.
 */
function shortDate(value: Date): string {
  return DATE.format(value).replace(/\.$/, "");
}

/**
 * The banner sentence.
 *
 * "Beställningar är pausade till 1 dec: …" when there is an end, and without
 * the date when there is not — a made-up end date would be worse than none.
 */
export function describePause(pause: PauseRow): string {
  const what =
    pause.scope === "BRAND" && pause.brandName
      ? `Beställningar av ${pause.brandName}`
      : "Beställningar";

  const until = pause.endsAt ? ` till ${shortDate(pause.endsAt)}` : "";
  return `${what} är pausade${until}: ${pause.message}`;
}

/** "Pausas från 1 dec" — for a pause that has not started yet. */
export function describeScheduled(pause: PauseRow): string {
  return `Beställningar pausas från ${shortDate(pause.startsAt)}: ${pause.message}`;
}

export type PauseValidation = { ok: true } | { ok: false; error: string };

export function validatePause(input: {
  scope: PauseScope;
  storeId: string | null;
  brandId: string | null;
  startsAt: Date;
  endsAt: Date | null;
  message: string;
}): PauseValidation {
  if (input.scope === "STORE" && !input.storeId) return { ok: false, error: "Välj en butik." };
  if (input.scope === "BRAND" && !input.brandId) {
    return { ok: false, error: "Välj ett varumärke." };
  }
  if (Number.isNaN(input.startsAt.getTime())) {
    return { ok: false, error: "Starttiden är ogiltig." };
  }
  if (input.endsAt && Number.isNaN(input.endsAt.getTime())) {
    return { ok: false, error: "Sluttiden är ogiltig." };
  }
  if (input.endsAt && input.endsAt.getTime() <= input.startsAt.getTime()) {
    return { ok: false, error: "Sluttiden måste vara efter starttiden." };
  }
  const message = input.message.trim();
  if (message.length === 0) return { ok: false, error: "Skriv ett meddelande till butikerna." };
  if (message.length > MAX_PAUSE_MESSAGE) {
    return { ok: false, error: `Meddelandet får vara högst ${MAX_PAUSE_MESSAGE} tecken.` };
  }
  return { ok: true };
}

/** What still works while ordering is paused. Shown on the order screen. */
export const PAUSE_STILL_WORKS = [
  "Du kan fortsätta lägga upp en beställning — utkastet sparas och försvinner inte.",
  "Tidigare beställningar går att visa, exportera och ta emot som vanligt.",
  "Allt annat i portalen fungerar.",
] as const;
