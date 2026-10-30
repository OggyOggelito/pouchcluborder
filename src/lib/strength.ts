/**
 * Nicotine strength in milligrams, and the fixed ranges the finder filters by.
 *
 * Ranges are named constants and purely numeric. Deliberately no "mild" or
 * "strong" labels of our own: brands use those words with their own meanings
 * (Regular / Strong / Extra Strong / Ultra Strong), and a 11 mg pouch is one
 * brand's "Extra Strong" and another's mid-range. The brand's own wording is
 * shown verbatim alongside, when the product data carries it.
 */
export const STRENGTH_RANGES = [
  { id: "0-6", label: "Upp till 6 mg", min: 0, max: 6 },
  { id: "7-11", label: "7–11 mg", min: 6.0001, max: 11 },
  { id: "12-16", label: "12–16 mg", min: 11.0001, max: 16 },
  { id: "17+", label: "17 mg och uppåt", min: 16.0001, max: Number.POSITIVE_INFINITY },
] as const;

export type StrengthRangeId = (typeof STRENGTH_RANGES)[number]["id"];

export function isStrengthRangeId(value: unknown): value is StrengthRangeId {
  return typeof value === "string" && STRENGTH_RANGES.some((range) => range.id === value);
}

/**
 * Milligrams for a product.
 *
 * Prefers the numeric column matched in from the supplier, and falls back to
 * reading a number out of the parsed `strength` text ("10mg", "10,4 mg").
 * Word strengths ("Strong", "#4", "S2") carry no milligram value and return
 * null rather than a guess.
 */
export function strengthMg(product: {
  nicotineMgPerPortion?: number | null;
  strength?: string | null;
}): number | null {
  if (typeof product.nicotineMgPerPortion === "number" && Number.isFinite(product.nicotineMgPerPortion)) {
    return product.nicotineMgPerPortion;
  }
  return parseStrengthMg(product.strength);
}

/** "10,4 mg" -> 10.4. Returns null when the text carries no number. */
export function parseStrengthMg(value: string | null | undefined): number | null {
  if (!value) return null;

  // A tier or code is not a milligram value.
  if (/^\s*(#\d|S\d)\s*$/i.test(value)) return null;

  const match = value.match(/(\d+(?:[.,]\d+)?)\s*mg/i) ?? value.match(/^\s*(\d+(?:[.,]\d+)?)\s*$/);
  if (!match) return null;

  const parsed = Number.parseFloat(match[1].replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function rangeForMg(mg: number | null): StrengthRangeId | null {
  if (mg === null) return null;
  const hit = STRENGTH_RANGES.find((range) => mg >= range.min && mg <= range.max);
  return hit ? hit.id : null;
}

export function matchesRange(mg: number | null, rangeId: StrengthRangeId): boolean {
  if (mg === null) return false;
  const range = STRENGTH_RANGES.find((candidate) => candidate.id === rangeId);
  return range ? mg >= range.min && mg <= range.max : false;
}

/** "10.4" -> "10,4" for display. */
export function formatMg(mg: number): string {
  return mg.toLocaleString("sv-SE", { maximumFractionDigits: 2 });
}
