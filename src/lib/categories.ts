/**
 * Product categories, shared by the importer and the UI so the two can't drift.
 * Kept free of any server-only imports — the order page is a client component.
 */
export const CATEGORIES = [
  "Nicotine pouch",
  "Nicotine-free pouch",
  "Tobacco snus",
  "Vape",
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Swedish labels for the shop floor. */
export const CATEGORY_LABELS: Record<string, string> = {
  "Nicotine pouch": "Vitt snus",
  "Nicotine-free pouch": "Nikotinfritt",
  "Tobacco snus": "Tobakssnus",
  Vape: "Vape",
};

/**
 * Artikeltyp -> category, matched lowercased because the masterdoc writes
 * "Vitt Snus", "VItt Snus" and "Vitt snus" for the same thing.
 */
export const ARTIKELTYP_TO_CATEGORY: Record<string, Category> = {
  "vitt snus": "Nicotine pouch",
  "nikotinfritt snus": "Nicotine-free pouch",
  tobakssnus: "Tobacco snus",
  vapes: "Vape",
};

/**
 * Names that say "no nicotine" outright. The masterdoc files some of these
 * under Vitt Snus by mistake — "XQS Virgin Peppermint Nikotinfri" and the four
 * "Après ... - ZERO" articles — so the name is trusted over Artikeltyp when it
 * is this explicit.
 *
 * Deliberately excludes "virgin" on its own: it names a mocktail flavour as
 * often as it means nicotine-free, and the one row that uses it here also says
 * "Nikotinfri".
 */
export const NICOTINE_FREE_MARKERS =
  /(\bnikotinfri(tt)?\b|\bno\s*nico\b|\bnicotine[\s-]?free\b|\bzero\b)/i;

export function isNicotineFreeName(name: string): boolean {
  return NICOTINE_FREE_MARKERS.test(name);
}

export function categoryLabel(category: string | null | undefined): string {
  if (!category) return "Övrigt";
  return CATEGORY_LABELS[category] ?? category;
}
