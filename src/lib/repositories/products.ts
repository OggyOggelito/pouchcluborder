import { prisma } from "@/lib/db";

export type CatalogProduct = {
  id: string;
  brand: string;
  flavor: string;
  strength: string;
  format: string;
  pricePerStock: number;
  category: string | null;
};

export type ProductInput = {
  brand: string;
  flavor: string;
  strength: string;
  format: string;
  pricePerStock: number;
};

/**
 * Extra columns the supplier .xlsx carries. The CSV path never sets these, so
 * every field is optional and a CSV import leaves whatever is already stored
 * untouched rather than blanking it.
 */
export type SupplierFields = Partial<{
  sku: string | null;
  category: string | null;
  manufacturerCode: string | null;
  supplier: string | null;
  unitsPerStock: number | null;
  unitPrice: number | null;
  casePrice: number | null;
  costPrice: number | null;
  eanKfp: string | null;
  eanDfp: string | null;
  stockMin: number | null;
  stockMax: number | null;
  sourceName: string | null;
  needsReview: boolean;
  reviewNotes: string | null;
}>;

const SUPPLIER_FIELDS = [
  "sku",
  "category",
  "manufacturerCode",
  "supplier",
  "unitsPerStock",
  "unitPrice",
  "casePrice",
  "costPrice",
  "eanKfp",
  "eanDfp",
  "stockMin",
  "stockMax",
  "sourceName",
  "needsReview",
  "reviewNotes",
] as const;

function supplierFieldsOf(row: ProductInput & SupplierFields): SupplierFields {
  const extras: Record<string, unknown> = {};
  for (const field of SUPPLIER_FIELDS) {
    if (field in row) extras[field] = row[field];
  }
  return extras as SupplierFields;
}

/** Everything the order page renders: active products only, ordered for grouping. */
export async function listActiveProducts(): Promise<CatalogProduct[]> {
  return prisma.product.findMany({
    where: { active: true },
    orderBy: [{ brand: "asc" }, { flavor: "asc" }, { strength: "asc" }, { format: "asc" }],
    select: {
      id: true,
      brand: true,
      flavor: true,
      strength: true,
      format: true,
      pricePerStock: true,
      category: true,
    },
  });
}

export async function countProducts(): Promise<{ total: number; active: number }> {
  const [total, active] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { active: true } }),
  ]);
  return { total, active };
}

export async function listBrands(): Promise<string[]> {
  const rows = await prisma.product.findMany({
    where: { active: true },
    distinct: ["brand"],
    orderBy: { brand: "asc" },
    select: { brand: true },
  });
  return rows.map((row) => row.brand);
}

export type ImportMode = "merge" | "replace";

export type ImportResult = {
  created: number;
  updated: number;
  deactivated: number;
};

/**
 * Upsert a catalog.
 *
 * "replace" deactivates everything first and reactivates only what the file
 * contains — products are never hard-deleted, because past OrderLines reference
 * them and an old order must stay re-exportable.
 */
export async function importProducts(
  rows: (ProductInput & SupplierFields)[],
  mode: ImportMode
): Promise<ImportResult> {
  return prisma.$transaction(async (tx) => {
    // Remember what was live before the import so "deactivated" reports the
    // products the new file genuinely dropped, not ones already switched off.
    const previouslyActive = new Set<string>(
      mode === "replace"
        ? (await tx.product.findMany({ where: { active: true }, select: { id: true } })).map(
            (product) => product.id
          )
        : []
    );

    if (mode === "replace") {
      await tx.product.updateMany({ where: { active: true }, data: { active: false } });
    }

    let created = 0;
    let updated = 0;
    // Counted in memory rather than with a final `id: { in: [...] }` query:
    // that list is one bind parameter per product and blows past SQLite's
    // 999-parameter limit once the catalog is bigger than that.
    let reactivated = 0;

    for (const row of rows) {
      const key = {
        brand_flavor_strength_format: {
          brand: row.brand,
          flavor: row.flavor,
          strength: row.strength,
          format: row.format,
        },
      };

      const existing = await tx.product.findUnique({ where: key, select: { id: true } });

      if (existing) {
        if (previouslyActive.has(existing.id)) reactivated += 1;
        await tx.product.update({
          where: key,
          data: { pricePerStock: row.pricePerStock, active: true, ...supplierFieldsOf(row) },
        });
        updated += 1;
      } else {
        await tx.product.create({
          data: {
            brand: row.brand,
            flavor: row.flavor,
            strength: row.strength,
            format: row.format,
            pricePerStock: row.pricePerStock,
            active: true,
            ...supplierFieldsOf(row),
          },
        });
        created += 1;
      }
    }

    // Everything active was switched off up front; whatever the file put back
    // is no longer deactivated.
    const deactivated = previouslyActive.size - reactivated;

    return { created, updated, deactivated };
  });
}

/** Products the name parser was unsure about, for the admin banner. */
export async function countNeedsReview(): Promise<number> {
  return prisma.product.count({ where: { active: true, needsReview: true } });
}

/** A brand's active catalog, for its staff page. */
export async function listActiveProductsForBrand(brandId: string): Promise<CatalogProduct[]> {
  return prisma.product.findMany({
    where: { brandId, active: true },
    orderBy: [{ category: "asc" }, { flavor: "asc" }, { strength: "asc" }, { format: "asc" }],
    select: {
      id: true,
      brand: true,
      flavor: true,
      strength: true,
      format: true,
      pricePerStock: true,
      category: true,
    },
  });
}
