/**
 * Global search: matching and ranking.
 *
 * Pure, so the behaviour that decides what a hurried person sees first is
 * testable without a database.
 *
 * Diacritics are folded the same way the order form's own search does it, so
 * "rapé" and "rape" find the same thing and a phone keyboard without easy
 * access to å, ä or ö is not a handicap.
 */

export const SEARCH_GROUPS = ["product", "brand", "news", "routine", "page"] as const;
export type SearchGroup = (typeof SEARCH_GROUPS)[number];

export const SEARCH_GROUP_LABELS: Record<SearchGroup, string> = {
  product: "Produkter",
  brand: "Varumärken",
  news: "Nyheter",
  routine: "Rutiner",
  page: "Sidor",
};

export type SearchHit = {
  group: SearchGroup;
  href: string;
  title: string;
  subtitle?: string;
};

/** Shortest query worth running. One letter matches most of the catalog. */
export const MIN_QUERY_LENGTH = 2;

/** Lowercased with diacritics stripped. */
export function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * How well a candidate matches, as a score where lower is better, or null for
 * no match.
 *
 * A prefix match beats a word-start match, which beats a match buried inside
 * the string — so typing "zy" puts ZYN above "Crazy Mint". Ties break on
 * length, so the shortest thing that matches comes first.
 */
export function scoreMatch(haystack: string, needle: string): number | null {
  const text = fold(haystack);
  const query = fold(needle);
  if (!query) return null;

  const index = text.indexOf(query);
  if (index === -1) return null;

  if (index === 0) return 0 + text.length / 1000;
  // A match that starts a word reads as intentional; one mid-word does not.
  const atWordStart = text[index - 1] === " " || text[index - 1] === "-";
  return (atWordStart ? 1 : 2) + text.length / 1000;
}

/** Matches on any of several fields, taking the best score. */
export function scoreFields(fields: (string | null | undefined)[], needle: string): number | null {
  let best: number | null = null;
  for (const field of fields) {
    if (!field) continue;
    const score = scoreMatch(field, needle);
    if (score !== null && (best === null || score < best)) best = score;
  }
  return best;
}

/** Sorts hits already carrying a score, then drops the score. */
export function rank<T>(scored: { score: number; value: T }[], limit: number): T[] {
  return [...scored]
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((entry) => entry.value);
}

/** Groups hits for rendering, keeping SEARCH_GROUPS order and dropping empties. */
export function groupHits(hits: SearchHit[]): { group: SearchGroup; label: string; hits: SearchHit[] }[] {
  return SEARCH_GROUPS.map((group) => ({
    group,
    label: SEARCH_GROUP_LABELS[group],
    hits: hits.filter((hit) => hit.group === group),
  })).filter((section) => section.hits.length > 0);
}
