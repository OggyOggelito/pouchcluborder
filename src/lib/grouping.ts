import { CATEGORIES } from "@/lib/categories";
import type { CatalogProduct } from "@/lib/repositories/products";

export type FlavorGroup = {
  key: string;
  flavor: string;
  variants: CatalogProduct[];
};

export type CategoryGroup = {
  key: string;
  category: string | null;
  flavors: FlavorGroup[];
  variantCount: number;
};

export type BrandGroup = {
  brand: string;
  /**
   * A brand can sit in more than one category — Lundgrens, Skruf, Loop, Velo and
   * Lewa all sell both pouches and something else — so category is a real level
   * of the tree rather than a label on the row.
   */
  categories: CategoryGroup[];
  variantCount: number;
};

/** "10mg" -> 10, so variants sort 6mg, 10mg, 16mg rather than alphabetically. */
function strengthValue(strength: string): number {
  const match = strength.match(/(\d+(?:[.,]\d+)?)/);
  return match ? Number.parseFloat(match[1].replace(",", ".")) : Number.POSITIVE_INFINITY;
}

const CATEGORY_ORDER = new Map<string, number>(CATEGORIES.map((name, index) => [name, index]));

function categoryRank(category: string | null): number {
  if (!category) return CATEGORIES.length;
  return CATEGORY_ORDER.get(category) ?? CATEGORIES.length;
}

/** Brand -> category -> flavor -> strength/format variants, in render order. */
export function groupCatalog(products: CatalogProduct[]): BrandGroup[] {
  const byBrand = new Map<string, Map<string, Map<string, CatalogProduct[]>>>();

  for (const product of products) {
    const categoryKey = product.category ?? "";

    let categories = byBrand.get(product.brand);
    if (!categories) {
      categories = new Map();
      byBrand.set(product.brand, categories);
    }

    let flavors = categories.get(categoryKey);
    if (!flavors) {
      flavors = new Map();
      categories.set(categoryKey, flavors);
    }

    const variants = flavors.get(product.flavor);
    if (variants) variants.push(product);
    else flavors.set(product.flavor, [product]);
  }

  return [...byBrand.entries()]
    .map(([brand, categories]) => {
      const categoryGroups: CategoryGroup[] = [...categories.entries()]
        .map(([categoryKey, flavors]) => {
          const flavorGroups = [...flavors.entries()]
            .map(([flavor, variants]) => ({
              key: `${brand}::${categoryKey}::${flavor}`,
              flavor,
              variants: [...variants].sort(
                (a, b) =>
                  strengthValue(a.strength) - strengthValue(b.strength) ||
                  a.format.localeCompare(b.format, "sv")
              ),
            }))
            .sort((a, b) => a.flavor.localeCompare(b.flavor, "sv"));

          return {
            key: `${brand}::${categoryKey}`,
            category: categoryKey || null,
            flavors: flavorGroups,
            variantCount: flavorGroups.reduce((sum, group) => sum + group.variants.length, 0),
          };
        })
        .sort((a, b) => categoryRank(a.category) - categoryRank(b.category));

      return {
        brand,
        categories: categoryGroups,
        variantCount: categoryGroups.reduce((sum, group) => sum + group.variantCount, 0),
      };
    })
    .sort((a, b) => a.brand.localeCompare(b.brand, "sv"));
}

/** Fold Swedish vowels so "skane" matches "Skåne" and "apres" matches "Après". */
export function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Every whitespace-separated token must match somewhere, so "loop mango" and
 * "white fox 30" both narrow the way staff expect.
 */
export function filterCatalog(groups: BrandGroup[], query: string): BrandGroup[] {
  const tokens = fold(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return groups;

  const result: BrandGroup[] = [];

  for (const group of groups) {
    const brandHaystack = fold(group.brand);

    if (tokens.every((token) => brandHaystack.includes(token))) {
      result.push(group);
      continue;
    }

    const categories = group.categories
      .map((categoryGroup) => {
        const flavors = categoryGroup.flavors.filter((flavorGroup) => {
          const haystack = fold(
            `${group.brand} ${flavorGroup.flavor} ${flavorGroup.variants
              .map((variant) => `${variant.strength} ${variant.format}`)
              .join(" ")}`
          );
          return tokens.every((token) => haystack.includes(token));
        });

        return {
          ...categoryGroup,
          flavors,
          variantCount: flavors.reduce((sum, flavorGroup) => sum + flavorGroup.variants.length, 0),
        };
      })
      .filter((categoryGroup) => categoryGroup.flavors.length > 0);

    if (categories.length > 0) {
      result.push({
        brand: group.brand,
        categories,
        variantCount: categories.reduce((sum, categoryGroup) => sum + categoryGroup.variantCount, 0),
      });
    }
  }

  return result;
}

/** Every variant in a brand, flattened — used for the per-brand quantity badge. */
export function brandVariants(group: BrandGroup): CatalogProduct[] {
  return group.categories.flatMap((categoryGroup) =>
    categoryGroup.flavors.flatMap((flavorGroup) => flavorGroup.variants)
  );
}
