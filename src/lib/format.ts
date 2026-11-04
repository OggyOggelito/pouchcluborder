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

/**
 * All dates in this app are Swedish store dates, so every formatter pins the
 * zone explicitly. Without it the server's zone decides, and a shift at 23:30
 * can render on the wrong day. `sv-SE` is already a 24-hour locale.
 */
const ZONE = "Europe/Stockholm";

export function formatDateTime(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: ZONE,
  }).format(date);
}

const shortDate = new Intl.DateTimeFormat("sv-SE", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: ZONE,
});

/** "ons 4 nov" — the house short form, for cards and lists. */
export function formatShortDate(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return shortDate.format(date);
}

const timeOnly = new Intl.DateTimeFormat("sv-SE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: ZONE,
});

/** "07:30" — 24-hour, zero-padded. */
export function formatTime(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return timeOnly.format(date);
}

/** "ons 4 nov 07:30". */
export function formatShortDateTime(value: Date | string): string {
  return `${formatShortDate(value)} ${formatTime(value)}`;
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
