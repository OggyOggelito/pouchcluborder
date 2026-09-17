const sek = new Intl.NumberFormat("sv-SE", {
  style: "currency",
  currency: "SEK",
  maximumFractionDigits: 2,
});

const plainNumber = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 2 });

export function formatSek(value: number): string {
  return sek.format(value);
}

export function formatNumber(value: number): string {
  return plainNumber.format(value);
}

export function formatDateTime(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Slug for a brand page URL.
 *
 * Separate from `slugify` because that one is used for store slugs and Excel
 * filenames and must keep behaving exactly as it does. Brand names carry
 * accents it was never built for — it turns "Göteborgs Rapé" into
 * "goteborgs-rap", losing the last letter — so this folds diacritics properly
 * first. Apostrophes are dropped rather than hyphenated, so "Lenny's Cut"
 * becomes "lennys-cut".
 */
export function brandSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
