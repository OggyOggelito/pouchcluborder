import { prisma } from "@/lib/db";

export type CatalogProduct = {
  id: string;
  brand: string;
  flavor: string;
  strength: string;
  format: string;
  pricePerStock: number;
};

export type ProductInput = {
  brand: string;
  flavor: string;
  strength: string;
  format: string;
  pricePerStock: number;
};

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
  rows: ProductInput[],
  mode: ImportMode
): Promise<ImportResult> {
  return prisma.$transaction(async (tx) => {
    // Remember what was live before the import so "deactivated" reports the
    // products the new file genuinely dropped, not ones already switched off.
    const previouslyActive =
      mode === "replace"
        ? await tx.product.findMany({ where: { active: true }, select: { id: true } })
        : [];

    if (mode === "replace") {
      await tx.product.updateMany({ where: { active: true }, data: { active: false } });
    }

    let created = 0;
    let updated = 0;

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
        await tx.product.update({
          where: key,
          data: { pricePerStock: row.pricePerStock, active: true },
        });
        updated += 1;
      } else {
        await tx.product.create({ data: { ...row, active: true } });
        created += 1;
      }
    }

    const deactivated =
      previouslyActive.length === 0
        ? 0
        : await tx.product.count({
            where: { id: { in: previouslyActive.map((p) => p.id) }, active: false },
          });

    return { created, updated, deactivated };
  });
}
