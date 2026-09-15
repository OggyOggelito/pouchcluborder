/**
 * Normalisation rules shared by the seed script and the CSV importer, so a
 * hand-written seed row and a row exported from Shopify land in the database in
 * exactly the same shape (and therefore hit the same unique key on re-import).
 */

export const PRODUCT_FORMATS = ["Mini", "Slim", "Normal", "Large"] as const;
export type ProductFormat = (typeof PRODUCT_FORMATS)[number];

export const DEFAULT_FORMAT: ProductFormat = "Normal";

/** "slim white dry" -> "Slim"; falls back to Normal when nothing matches. */
export function normalizeFormat(...candidates: (string | null | undefined)[]): ProductFormat {
  const haystack = candidates.filter(Boolean).join(" ").toLowerCase();

  // Order matters: "slim" must be tested before "mini" is ruled out, and
  // "large"/"maxi" before the Normal fallback.
  if (/\bmini\b/.test(haystack)) return "Mini";
  if (/\bslim\b/.test(haystack)) return "Slim";
  if (/\b(large|maxi|big)\b/.test(haystack)) return "Large";
  if (/\b(normal|regular|original)\b/.test(haystack)) return "Normal";

  return DEFAULT_FORMAT;
}

/** "10", "10 mg", "10MG", "10mg/g" -> "10mg". Unparseable input is kept as-is. */
export function normalizeStrength(raw: string | null | undefined): string {
  const value = (raw ?? "").trim();
  if (!value) return "";

  const match = value.replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  if (!match) return value;

  const amount = Number.parseFloat(match[1]);
  if (!Number.isFinite(amount)) return value;

  // Drop a trailing ".0" so "10.0" and "10" are the same variant.
  const normalized = Number.isInteger(amount) ? String(amount) : String(amount);
  return `${normalized}mg`;
}

/** Accepts "49,90", "49.90", "49,90 kr", "1 299,00" -> number in SEK. */
export function parsePrice(raw: string | number | null | undefined): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) && raw >= 0 ? raw : null;

  const value = (raw ?? "")
    .toString()
    .replace(/\s| /g, "")
    .replace(/kr|sek/gi, "")
    .trim();
  if (!value) return null;

  // Swedish exports use comma as the decimal separator; tolerate both.
  const normalized = value.includes(",") && !value.includes(".")
    ? value.replace(",", ".")
    : value.replace(/,/g, "");

  const price = Number.parseFloat(normalized);
  return Number.isFinite(price) && price >= 0 ? price : null;
}

