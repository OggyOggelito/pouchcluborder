import { prisma } from "@/lib/db";
import { articleSlug } from "@/lib/knowledge";

export type ArticleSummary = {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  published: boolean;
  updatedAt: Date;
  updatedByName: string | null;
};

export type ArticleDetail = ArticleSummary & { body: string };

const ARTICLE_SELECT = {
  id: true,
  title: true,
  slug: true,
  category: true,
  published: true,
  body: true,
  updatedAt: true,
  updatedBy: { select: { name: true, email: true } },
} as const;

type RawArticle = {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  published: boolean;
  body: string;
  updatedAt: Date;
  updatedBy: { name: string | null; email: string } | null;
};

function toDetail(article: RawArticle): ArticleDetail {
  return {
    id: article.id,
    title: article.title,
    slug: article.slug,
    category: article.category,
    published: article.published,
    body: article.body,
    updatedAt: article.updatedAt,
    updatedByName: article.updatedBy?.name?.trim() || article.updatedBy?.email || null,
  };
}

/**
 * Published articles, with bodies.
 *
 * The bodies come along because search matches on them — see `filterArticles`
 * in src/lib/knowledge.ts for why that filtering happens in memory.
 */
export async function listPublishedArticles(): Promise<ArticleDetail[]> {
  const rows = await prisma.knowledgeArticle.findMany({
    where: { published: true },
    orderBy: [{ category: "asc" }, { title: "asc" }],
    select: ARTICLE_SELECT,
  });
  return (rows as RawArticle[]).map(toDetail);
}

/** Drafts included — for /admin/routines. */
export async function listAllArticles(): Promise<ArticleDetail[]> {
  const rows = await prisma.knowledgeArticle.findMany({
    orderBy: [{ published: "asc" }, { title: "asc" }],
    select: ARTICLE_SELECT,
  });
  return (rows as RawArticle[]).map(toDetail);
}

export async function getArticleBySlug(slug: string): Promise<ArticleDetail | null> {
  if (!slug) return null;
  const article = await prisma.knowledgeArticle.findUnique({
    where: { slug },
    select: ARTICLE_SELECT,
  });
  return article ? toDetail(article as RawArticle) : null;
}

export async function getArticleById(id: string): Promise<ArticleDetail | null> {
  if (!id) return null;
  const article = await prisma.knowledgeArticle.findUnique({
    where: { id },
    select: ARTICLE_SELECT,
  });
  return article ? toDetail(article as RawArticle) : null;
}

/**
 * A slug nobody else holds.
 *
 * The slug is derived from the title but never changes on its own afterwards:
 * a published routine's URL is the thing people bookmark and link to from a
 * checklist, so renaming the title leaves the URL alone. Only a new article
 * takes a slug, and a collision gets a numeric suffix.
 */
async function uniqueSlug(title: string): Promise<string> {
  const base = articleSlug(title);
  let candidate = base;
  for (let suffix = 2; suffix < 100; suffix += 1) {
    const taken = await prisma.knowledgeArticle.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
    candidate = `${base}-${suffix}`;
  }
  return `${base}-${Date.now()}`;
}

export async function createArticle(input: {
  title: string;
  body: string;
  category: string | null;
  published: boolean;
  userId: string;
}): Promise<string> {
  const article = await prisma.knowledgeArticle.create({
    data: {
      title: input.title,
      slug: await uniqueSlug(input.title),
      body: input.body,
      category: input.category,
      published: input.published,
      updatedById: input.userId,
    },
    select: { id: true },
  });
  return article.id;
}

export async function updateArticle(input: {
  id: string;
  title: string;
  body: string;
  category: string | null;
  published: boolean;
  userId: string;
}): Promise<void> {
  await prisma.knowledgeArticle.update({
    where: { id: input.id },
    data: {
      title: input.title,
      body: input.body,
      category: input.category,
      published: input.published,
      updatedById: input.userId,
    },
  });
}

export async function deleteArticle(id: string): Promise<void> {
  await prisma.knowledgeArticle.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export type CategoryRow = { id: string; name: string; sortOrder: number; articleCount: number };

export async function listCategories(): Promise<CategoryRow[]> {
  const [categories, counts] = await Promise.all([
    prisma.knowledgeCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.knowledgeArticle.groupBy({ by: ["category"], _count: { _all: true } }),
  ]);

  const byName = new Map(
    counts.map((row) => [row.category ?? "", row._count._all] as const)
  );

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    sortOrder: category.sortOrder,
    articleCount: byName.get(category.name) ?? 0,
  }));
}

export async function createCategory(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  const existing = await prisma.knowledgeCategory.findUnique({
    where: { name: trimmed },
    select: { id: true },
  });
  if (existing) return;

  const last = await prisma.knowledgeCategory.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  await prisma.knowledgeCategory.create({
    data: { name: trimmed, sortOrder: (last?.sortOrder ?? 0) + 1 },
  });
}

/**
 * Removes a category. Articles keep the string they were filed under, so
 * deleting a category never silently rewrites content — they simply stop
 * matching a chip, and the editor shows the stale value for correction.
 */
export async function deleteCategory(id: string): Promise<void> {
  await prisma.knowledgeCategory.delete({ where: { id } });
}
