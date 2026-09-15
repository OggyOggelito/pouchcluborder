import type { CatalogProduct } from "@/lib/repositories/products";

/** "10mg" -> 10, so variants sort 6mg, 10mg, 16mg rather than alphabetically. */
function strengthValue(strength: string): number {
  const match = strength.match(/(\d+(?:[.,]\d+)?)/);
  return match ? Number.parseFloat(match[1].replace(",", ".")) : Number.POSITIVE_INFINITY;
}

export type FlavorGroup = {
  key: string;
  flavor: string;
  variants: CatalogProduct[];
};

export type BrandGroup = {
  brand: string;
  flavors: FlavorGroup[];
  variantCount: number;
};

/** Brand -> flavor -> strength/format variants, in the order the list renders. */
export function groupCatalog(products: CatalogProduct[]): BrandGroup[] {
  const byBrand = new Map<string, Map<string, CatalogProduct[]>>();

  for (const product of products) {
    let flavors = byBrand.get(product.brand);
    if (!flavors) {
      flavors = new Map();
      byBrand.set(product.brand, flavors);
    }
    const variants = flavors.get(product.flavor);
    if (variants) variants.push(product);
    else flavors.set(product.flavor, [product]);
  }

  return [...byBrand.entries()]
    .map(([brand, flavors]) => ({
      brand,
      variantCount: [...flavors.values()].reduce((sum, variants) => sum + variants.length, 0),
      flavors: [...flavors.entries()]
        .map(([flavor, variants]) => ({
          key: `${brand}::${flavor}`,
          flavor,
          variants: [...variants].sort(
            (a, b) =>
              strengthValue(a.strength) - strengthValue(b.strength) ||
              a.format.localeCompare(b.format, "sv")
          ),
        }))
        .sort((a, b) => a.flavor.localeCompare(b.flavor, "sv")),
    }))
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

    const flavors = group.flavors.filter((flavorGroup) => {
      const haystack = fold(
        `${group.brand} ${flavorGroup.flavor} ${flavorGroup.variants
          .map((variant) => `${variant.strength} ${variant.format}`)
          .join(" ")}`
      );
      return tokens.every((token) => haystack.includes(token));
    });

    if (flavors.length > 0) {
      result.push({
        brand: group.brand,
        flavors,
        variantCount: flavors.reduce((sum, flavorGroup) => sum + flavorGroup.variants.length, 0),
      });
    }
  }

  return result;
}
