import { prisma } from "@/lib/db";
import { brandSlug } from "@/lib/format";

export type BrandSummary = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  logoUrl: string | null;
  published: boolean;
  productCount: number;
  categories: string[];
  /** Active products per category, so a section heading can show its own count. */
  productCountByCategory: Record<string, number>;
};

export type BrandDetail = {
  id: string;
  name: string;
  slug: string;
  manufacturerCode: string | null;
  countryOfOrigin: string | null;
  shortDescription: string | null;
  manufacturingProcess: string | null;
  blendingNotes: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  websiteUrl: string | null;
  published: boolean;
};

export type BrandContentInput = {
  manufacturerCode: string | null;
  countryOfOrigin: string | null;
  shortDescription: string | null;
  manufacturingProcess: string | null;
  blendingNotes: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  websiteUrl: string | null;
  published: boolean;
};

/** True when nothing has been written yet, so the staff page can say so. */
export function hasContent(brand: BrandDetail): boolean {
  return Boolean(
    brand.shortDescription?.trim() ||
      brand.manufacturingProcess?.trim() ||
      brand.blendingNotes?.trim()
  );
}

/**
 * Creates a Brand row for every distinct brand on a product and links the
 * products to it.
 *
 * Run once by `npm run backfill:brands`, and again after every catalog import
 * so a newly imported brand gets a (draft, empty) page rather than a broken
 * link. Content is never touched — only the rows and the relation.
 */
export async function syncBrandsFromProducts(): Promise<{
  created: number;
  linked: number;
  brands: number;
}> {
  const distinct = await prisma.product.findMany({
    select: { brand: true },
    distinct: ["brand"],
    orderBy: { brand: "asc" },
  });

  const existing = await prisma.brand.findMany({ select: { id: true, name: true, slug: true } });
  const byName = new Map(existing.map((brand) => [brand.name, brand]));
  const usedSlugs = new Set(existing.map((brand) => brand.slug));

  let created = 0;

  for (const { brand: name } of distinct) {
    if (!name || byName.has(name)) continue;

    // Slugs are unique in the schema. No two of the 71 current brands collide,
    // but a future import could add one that does, and an import must not fail
    // over a page URL.
    const base = brandSlug(name) || "brand";
    let slug = base;
    for (let suffix = 2; usedSlugs.has(slug); suffix += 1) slug = `${base}-${suffix}`;
    usedSlugs.add(slug);

    const record = await prisma.brand.create({
      data: { name, slug },
      select: { id: true, name: true, slug: true },
    });
    byName.set(name, record);
    created += 1;
  }

  // Link products whose brandId is missing or points at the wrong brand (a
  // product can change brand when the parser is corrected, as Knox did).
  let linked = 0;
  for (const [name, brand] of byName) {
    const result = await prisma.product.updateMany({
      // `NOT: { brandId: id }` would skip rows where brandId IS NULL, because
      // SQL comparisons against NULL are never true — which is exactly the set
      // this backfill exists to populate.
      where: {
        brand: name,
        OR: [{ brandId: null }, { brandId: { not: brand.id } }],
      },
      data: { brandId: brand.id },
    });
    linked += result.count;
  }

  return { created, linked, brands: byName.size };
}

/** Every brand, with product counts — the admin content list. */
export async function listBrandsForAdmin(): Promise<BrandSummary[]> {
  const brands = await prisma.brand.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      shortDescription: true,
      logoUrl: true,
      published: true,
      products: { where: { active: true }, select: { category: true } },
    },
  });

  return brands.map(toSummary);
}

/** Published brands that still have something in the catalog, for /staff. */
export async function listPublishedBrands(): Promise<BrandSummary[]> {
  const brands = await prisma.brand.findMany({
    where: { published: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      shortDescription: true,
      logoUrl: true,
      published: true,
      products: { where: { active: true }, select: { category: true } },
    },
  });

  return brands.map(toSummary);
}

export async function getBrandById(id: string): Promise<BrandDetail | null> {
  return prisma.brand.findUnique({ where: { id }, select: DETAIL_SELECT });
}

export async function getPublishedBrandBySlug(slug: string): Promise<BrandDetail | null> {
  const brand = await prisma.brand.findUnique({ where: { slug }, select: DETAIL_SELECT });
  return brand?.published ? brand : null;
}

export async function updateBrandContent(
  id: string,
  input: BrandContentInput
): Promise<BrandDetail> {
  return prisma.brand.update({ where: { id }, data: input, select: DETAIL_SELECT });
}

const DETAIL_SELECT = {
  id: true,
  name: true,
  slug: true,
  manufacturerCode: true,
  countryOfOrigin: true,
  shortDescription: true,
  manufacturingProcess: true,
  blendingNotes: true,
  logoUrl: true,
  heroImageUrl: true,
  websiteUrl: true,
  published: true,
} as const;

function toSummary(brand: {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  logoUrl: string | null;
  published: boolean;
  products: { category: string | null }[];
}): BrandSummary {
  const productCountByCategory: Record<string, number> = {};
  for (const product of brand.products) {
    const key = product.category ?? "";
    productCountByCategory[key] = (productCountByCategory[key] ?? 0) + 1;
  }

  const categories = [...new Set(brand.products.map((p) => p.category).filter(Boolean))] as string[];
  return {
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    shortDescription: brand.shortDescription,
    logoUrl: brand.logoUrl,
    published: brand.published,
    productCount: brand.products.length,
    categories,
    productCountByCategory,
  };
}
