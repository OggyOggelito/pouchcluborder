"use server";

import { prisma } from "@/lib/db";
import { getFeatures } from "@/lib/features";
import { searchablePagesFor } from "@/config/navigation";
import { MIN_QUERY_LENGTH, type SearchHit, rank, scoreFields } from "@/lib/search";
import { getSessionUser } from "@/lib/session";

const PER_GROUP = 5;

/**
 * One query across products, brands, news, routines and the app's own pages.
 *
 * Scoped by the caller's role: an OWNER never gets an admin page in the
 * results, drafts never surface, and a signed-out visitor sees only the public
 * guide. Matching and ranking happen in memory via src/lib/search.ts, because
 * SQLite through Prisma has no case-insensitive `contains` and the catalog is
 * small enough to rank properly rather than alphabetically.
 */
export async function globalSearchAction(query: string): Promise<SearchHit[]> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return [];

  const user = await getSessionUser();
  const features = await getFeatures();

  /** Scores every candidate on the given fields and keeps the best few. */
  function collect<T>(
    items: T[],
    toHit: (item: T) => { fields: (string | null | undefined)[]; hit: SearchHit }
  ): SearchHit[] {
    const scored: { score: number; value: SearchHit }[] = [];
    for (const item of items) {
      const { fields, hit } = toHit(item);
      const score = scoreFields(fields, trimmed);
      if (score !== null) scored.push({ score, value: hit });
    }
    return rank(scored, PER_GROUP);
  }

  const [products, brands, news, routines] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      select: { id: true, brand: true, flavor: true, strength: true, format: true },
    }),
    features.guide
      ? prisma.brand.findMany({
          where: { published: true },
          select: { name: true, slug: true, shortDescription: true },
        })
      : [],
    user && features.news
      ? prisma.announcement.findMany({
          where: { publishedAt: { not: null } },
          select: { id: true, title: true, body: true },
          orderBy: { publishedAt: "desc" },
          take: 200,
        })
      : [],
    user && features.routines
      ? prisma.knowledgeArticle.findMany({
          where: { published: true },
          select: { slug: true, title: true, body: true, category: true },
        })
      : [],
  ]);

  return [
    ...collect(products, (product) => {
      const label = `${product.brand} ${product.flavor}`.trim();
      return {
        fields: [label, product.brand, product.flavor],
        hit: {
          group: "product",
          // The finder is where a product question gets answered, and it takes
          // the same ?q= the order search uses.
          href: `/staff/finder?q=${encodeURIComponent(label)}`,
          title: label,
          subtitle: [product.strength, product.format].filter(Boolean).join(" · ") || undefined,
        },
      };
    }),

    ...collect(brands, (brand) => ({
      fields: [brand.name],
      hit: {
        group: "brand",
        href: `/staff/brands/${brand.slug}`,
        title: brand.name,
        subtitle: brand.shortDescription?.slice(0, 70) ?? undefined,
      },
    })),

    ...collect(news, (item) => ({
      fields: [item.title, item.body],
      hit: { group: "news", href: "/news", title: item.title },
    })),

    ...collect(routines, (article) => ({
      fields: [article.title, article.body],
      hit: {
        group: "routine",
        href: `/staff/routines/${article.slug}`,
        title: article.title,
        subtitle: article.category ?? undefined,
      },
    })),

    ...collect(searchablePagesFor(user?.role ?? null, features), (page) => ({
      fields: [page.label, page.description],
      hit: {
        group: "page",
        href: page.href,
        title: page.label,
        subtitle: page.description,
      },
    })),
  ];
}
