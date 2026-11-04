/**
 * Order drafts — the lines of an order in progress.
 *
 * Pure parsing and merging, so the rules that decide whether a draft is safe
 * to restore can be tested without a database or a browser.
 */

export type DraftLines = Record<string, number>;

/** Lines are stored as a JSON document; anything malformed becomes empty. */
export function parseLines(raw: string | null | undefined): DraftLines {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const out: DraftLines = {};
    for (const [productId, value] of Object.entries(parsed as Record<string, unknown>)) {
      const quantity = typeof value === "number" ? Math.trunc(value) : Number.NaN;
      if (Number.isFinite(quantity) && quantity > 0) out[productId] = quantity;
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeLines(lines: DraftLines): string {
  const clean: DraftLines = {};
  for (const [productId, quantity] of Object.entries(lines)) {
    const value = Math.trunc(quantity);
    if (Number.isFinite(value) && value > 0) clean[productId] = value;
  }
  return JSON.stringify(clean);
}

export function totalQuantity(lines: DraftLines): number {
  return Object.values(lines).reduce((sum, quantity) => sum + quantity, 0);
}

export function lineCount(lines: DraftLines): number {
  return Object.keys(lines).length;
}

/** A draft worth offering to restore has at least one line. */
export function isRestorable(lines: DraftLines): boolean {
  return lineCount(lines) > 0;
}

/**
 * Drops lines whose product is no longer in the catalog.
 *
 * A draft can outlive a re-import. Submitting a vanished product would fail at
 * the database, so it is dropped here and the caller tells the user how many
 * went — silently losing lines would be worse than either.
 */
export function pruneToCatalog(
  lines: DraftLines,
  availableProductIds: Iterable<string>
): { lines: DraftLines; dropped: number } {
  const available = new Set(availableProductIds);
  const kept: DraftLines = {};
  let dropped = 0;

  for (const [productId, quantity] of Object.entries(lines)) {
    if (available.has(productId)) kept[productId] = quantity;
    else dropped += 1;
  }

  return { lines: kept, dropped };
}

export type DraftConflict = { kind: "conflict"; serverVersion: number };
export type DraftSaved = { kind: "saved"; version: number; savedAt: string };
export type DraftSaveResult = DraftSaved | DraftConflict;

/**
 * Whether a save may proceed.
 *
 * The client sends the version it last saw. If the stored version has moved
 * on, the same draft was edited somewhere else — another device, another tab —
 * and overwriting it would throw away work the person cannot get back. The
 * caller warns instead.
 *
 * A client that has never saved sends 0 and always wins: there is nothing of
 * its own to lose.
 */
export function mayOverwrite(clientVersion: number, serverVersion: number): boolean {
  if (clientVersion === 0) return true;
  return clientVersion >= serverVersion;
}
