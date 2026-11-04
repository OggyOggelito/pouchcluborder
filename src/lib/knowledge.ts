/**
 * Routines and FAQ — "how do we do this".
 *
 * Separate from the brand pages on purpose: those are about products, these
 * are about the shop. The app ships no real routines, only one example
 * article explaining how to write them; procedures, legal and compliance text
 * are for Pouch Club to write, not for this codebase to guess at.
 */

import { brandSlug } from "@/lib/format";

/** The seeded placeholder. Named so the seed stays idempotent. */
export const EXAMPLE_ARTICLE_TITLE = "EXEMPEL – ta bort";

export const MAX_ARTICLE_TITLE_LENGTH = 120;

/**
 * Slug for /staff/routines/[slug].
 *
 * `brandSlug` rather than `slugify`: article titles carry Swedish letters and
 * apostrophes, and brandSlug is the one that folds diacritics properly.
 */
export function articleSlug(title: string): string {
  return brandSlug(title) || "artikel";
}

export type ArticleLike = {
  title: string;
  body: string;
  category: string | null;
};

/** Normalised for comparison: lowercased and diacritics folded. */
function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Category chips plus free-text search.
 *
 * Filtered in memory rather than in SQL because SQLite has no case-insensitive
 * `contains` through Prisma (`mode: "insensitive"` is unsupported), and because
 * a routine library is tens of articles, not thousands. If it ever grows past
 * that, this becomes an FTS table — the signature stays.
 *
 * A query matches on title or body, so "stängning" finds the closing routine
 * whether the word is in the heading or three paragraphs down.
 */
export function filterArticles<T extends ArticleLike>(
  articles: T[],
  filter: { category?: string | null; query?: string | null }
): T[] {
  const category = filter.category?.trim() || null;
  const query = fold(filter.query?.trim() ?? "");

  return articles.filter((article) => {
    if (category && article.category !== category) return false;
    if (!query) return true;
    return fold(article.title).includes(query) || fold(article.body).includes(query);
  });
}
