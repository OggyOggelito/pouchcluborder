import { prisma } from "@/lib/db";
import type { SalesLine } from "@/lib/sales/types";
import type { SalesRow } from "@/lib/sales/aggregate";

/**
 * Storing and reading sales.
 *
 * Two rules hold this together. An import of a day **replaces** that day for
 * that shop, so running the same file twice cannot double a figure. And a row
 * that cannot be tied to a product is written to `sales_unmatched` rather than
 * dropped — a silently missing day is the one failure a supplier would never
 * notice and we would never be able to explain.
 */
export type ImportResult = {
  importId: string;
  rowsRead: number;
  rowsStored: number;
  rowsUnmatched: number;
  unknownStores: string[];
  from: string;
  to: string;
};

type CatalogEntry = { id: string; brandId: string | null };

/** Chunked to stay well inside SQLite's 999 bind parameters. */
const CHUNK = 200;

function chunk<T>(items: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

function key(value: string | null | undefined): string | null {
  const text = (value ?? "").trim().toLowerCase();
  return text === "" ? null : text;
}

/**
 * Writes a parsed file.
 *
 * Matching order is EAN, then SKU, and nothing else. A name is not a key:
 * "Loop Mango 12" is three products in two formats, and guessing from a
 * description is how a figure ends up against the wrong flavour.
 */
export async function importSales(input: {
  lines: SalesLine[];
  source: string;
  fileName: string | null;
  createdById: string | null;
}): Promise<ImportResult> {
  const dates = input.lines.map((line) => line.date).sort();
  const from = dates[0] ?? "";
  const to = dates[dates.length - 1] ?? "";

  const [stores, products] = await Promise.all([
    prisma.store.findMany({ select: { id: true, name: true, slug: true } }),
    prisma.product.findMany({
      select: { id: true, brandId: true, sku: true, eanKfp: true, eanDfp: true },
    }),
  ]);

  const storeByKey = new Map<string, string>();
  for (const store of stores) {
    storeByKey.set(store.name.toLowerCase(), store.id);
    storeByKey.set(store.slug.toLowerCase(), store.id);
    storeByKey.set(store.id.toLowerCase(), store.id);
  }

  const byEan = new Map<string, CatalogEntry>();
  const bySku = new Map<string, CatalogEntry>();
  for (const product of products) {
    const entry = { id: product.id, brandId: product.brandId };
    for (const ean of [product.eanKfp, product.eanDfp]) {
      const found = key(ean);
      if (found) byEan.set(found, entry);
    }
    const sku = key(product.sku);
    if (sku) bySku.set(sku, entry);
  }

  const unknownStores = new Set<string>();

  type Resolved = {
    storeId: string;
    date: string;
    productId: string;
    quantity: number;
    amount: number | null;
  };
  const resolved = new Map<string, Resolved>();
  const unmatched: SalesLine[] = [];

  for (const line of input.lines) {
    const storeId =
      (line.storeId && storeByKey.get(line.storeId.toLowerCase())) ??
      (line.storeName ? storeByKey.get(line.storeName.trim().toLowerCase()) : undefined);

    const ean = key(line.ean);
    const sku = key(line.sku);
    const product = (ean ? byEan.get(ean) : undefined) ?? (sku ? bySku.get(sku) : undefined);

    if (!storeId) {
      if (line.storeName) unknownStores.add(line.storeName);
      unmatched.push(line);
      continue;
    }
    if (!product) {
      unmatched.push({ ...line, storeId });
      continue;
    }

    // A file may list the same product twice for a day — two tills, two
    // departments. They are the same day's sales and add up.
    const id = `${storeId}|${line.date}|${product.id}`;
    const existing = resolved.get(id);
    if (existing) {
      existing.quantity += line.quantity;
      if (line.grossAmount !== null && line.grossAmount !== undefined) {
        existing.amount = (existing.amount ?? 0) + line.grossAmount;
      }
      continue;
    }
    resolved.set(id, {
      storeId,
      date: line.date,
      productId: product.id,
      quantity: line.quantity,
      amount: line.grossAmount ?? null,
    });
  }

  const rows = [...resolved.values()];

  const record = await prisma.salesImport.create({
    data: {
      source: input.source,
      fileName: input.fileName,
      fromDate: from,
      toDate: to,
      rowsRead: input.lines.length,
      rowsStored: rows.length,
      rowsUnmatched: unmatched.length,
      createdById: input.createdById,
    },
    select: { id: true },
  });

  // Replace, never add to. Every (store, day) the file mentions is cleared
  // first, so the same file twice is the same figures twice — not double.
  const byStore = new Map<string, Set<string>>();
  for (const row of rows) {
    byStore.set(row.storeId, (byStore.get(row.storeId) ?? new Set()).add(row.date));
  }
  for (const [storeId, days] of byStore) {
    for (const part of chunk([...days])) {
      await prisma.salesDaily.deleteMany({ where: { storeId, date: { in: part } } });
    }
  }

  for (const part of chunk(rows, 50)) {
    await prisma.salesDaily.createMany({
      data: part.map((row) => ({ ...row, importId: record.id })),
    });
  }

  for (const part of chunk(unmatched, 50)) {
    await prisma.salesUnmatched.createMany({
      data: part.map((line) => ({
        importId: record.id,
        sku: line.sku ?? null,
        ean: line.ean ?? null,
        description: line.description ?? null,
        storeName: line.storeName ?? null,
        storeId: line.storeId ?? null,
        date: line.date,
        quantity: line.quantity,
        amount: line.grossAmount ?? null,
      })),
    });
  }

  return {
    importId: record.id,
    rowsRead: input.lines.length,
    rowsStored: rows.length,
    rowsUnmatched: unmatched.length,
    unknownStores: [...unknownStores],
    from,
    to,
  };
}

const ROW_SELECT = {
  date: true,
  quantity: true,
  amount: true,
  store: { select: { id: true, name: true } },
  product: { select: { id: true, flavor: true, strength: true, format: true } },
} as const;

type RawRow = {
  date: string;
  quantity: number;
  amount: number | null;
  store: { id: string; name: string };
  product: { id: string; flavor: string; strength: string; format: string };
};

function toRow(row: RawRow): SalesRow {
  return {
    date: row.date,
    storeId: row.store.id,
    storeName: row.store.name,
    productId: row.product.id,
    flavor: row.product.flavor,
    strength: row.product.strength,
    format: row.product.format,
    quantity: row.quantity,
    amount: row.amount,
  };
}

/**
 * One brand's rows.
 *
 * `brandId` is not optional and there is no "all brands" branch: this is the
 * function the supplier pages call, and a parameter that could be left out is
 * a parameter that will be, one day, in a hurry.
 */
export async function getBrandSales(input: {
  brandId: string;
  from: string;
  to: string;
  storeId?: string | null;
}): Promise<SalesRow[]> {
  const rows = await prisma.salesDaily.findMany({
    where: {
      date: { gte: input.from, lte: input.to },
      product: { brandId: input.brandId },
      ...(input.storeId ? { storeId: input.storeId } : {}),
    },
    orderBy: [{ date: "asc" }],
    select: ROW_SELECT,
  });
  return rows.map(toRow);
}

/** Every brand — the admin overview, and nothing a supplier can reach. */
export async function getAllSales(input: {
  from: string;
  to: string;
  brandId?: string | null;
}): Promise<SalesRow[]> {
  const rows = await prisma.salesDaily.findMany({
    where: {
      date: { gte: input.from, lte: input.to },
      ...(input.brandId ? { product: { brandId: input.brandId } } : {}),
    },
    orderBy: [{ date: "asc" }],
    select: ROW_SELECT,
  });
  return rows.map(toRow);
}

export async function salesCoverage(): Promise<{
  rows: number;
  from: string | null;
  to: string | null;
}> {
  const [rows, first, last] = await Promise.all([
    prisma.salesDaily.count(),
    prisma.salesDaily.findFirst({ orderBy: { date: "asc" }, select: { date: true } }),
    prisma.salesDaily.findFirst({ orderBy: { date: "desc" }, select: { date: true } }),
  ]);
  return { rows, from: first?.date ?? null, to: last?.date ?? null };
}

export type ImportSummary = {
  id: string;
  source: string;
  fileName: string | null;
  fromDate: string;
  toDate: string;
  rowsRead: number;
  rowsStored: number;
  rowsUnmatched: number;
  createdAt: Date;
  byName: string | null;
};

export async function listImports(limit = 20): Promise<ImportSummary[]> {
  const rows = await prisma.salesImport.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      source: true,
      fileName: true,
      fromDate: true,
      toDate: true,
      rowsRead: true,
      rowsStored: true,
      rowsUnmatched: true,
      createdAt: true,
      createdBy: { select: { name: true, email: true } },
    },
  });

  return rows.map((row) => ({
    ...row,
    byName: row.createdBy?.name ?? row.createdBy?.email ?? null,
  }));
}

export type UnmatchedRow = {
  id: string;
  sku: string | null;
  ean: string | null;
  description: string | null;
  storeName: string | null;
  date: string;
  quantity: number;
};

export async function listUnmatched(limit = 100): Promise<UnmatchedRow[]> {
  return prisma.salesUnmatched.findMany({
    where: { resolvedAt: null },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      sku: true,
      ean: true,
      description: true,
      storeName: true,
      date: true,
      quantity: true,
    },
  });
}

export async function countUnmatched(): Promise<number> {
  return prisma.salesUnmatched.count({ where: { resolvedAt: null } });
}

/**
 * Tying an orphan row to a product.
 *
 * Writes the sales row as well as marking the orphan resolved, so the figure
 * appears where it should without re-running the import — and adds to any row
 * already there for that day, because the orphan was always part of that day.
 */
export async function resolveUnmatched(input: {
  id: string;
  productId: string;
}): Promise<boolean> {
  const row = await prisma.salesUnmatched.findUnique({
    where: { id: input.id },
    select: { id: true, storeId: true, date: true, quantity: true, amount: true, resolvedAt: true },
  });
  if (!row || row.resolvedAt || !row.storeId) return false;

  const existing = await prisma.salesDaily.findUnique({
    where: {
      storeId_date_productId: {
        storeId: row.storeId,
        date: row.date,
        productId: input.productId,
      },
    },
    select: { id: true, quantity: true, amount: true },
  });

  if (existing) {
    await prisma.salesDaily.update({
      where: { id: existing.id },
      data: {
        quantity: existing.quantity + row.quantity,
        amount: row.amount === null ? existing.amount : (existing.amount ?? 0) + row.amount,
      },
    });
  } else {
    await prisma.salesDaily.create({
      data: {
        storeId: row.storeId,
        date: row.date,
        productId: input.productId,
        quantity: row.quantity,
        amount: row.amount,
      },
    });
  }

  await prisma.salesUnmatched.update({
    where: { id: row.id },
    data: { resolvedAt: new Date(), resolvedProductId: input.productId },
  });
  return true;
}
