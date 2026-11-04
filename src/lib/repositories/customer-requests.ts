import { prisma } from "@/lib/db";
import {
  clampText,
  dedupKey,
  toRequestKind,
  toRequestStatus,
  type RequestKind,
  type RequestStatus,
} from "@/lib/customer-requests";

export type SimilarRequest = {
  id: string;
  brandText: string | null;
  flavorText: string | null;
  kind: RequestKind;
  count: number;
  lastSeenAt: Date;
};

/**
 * Logs a request, or increments the existing one.
 *
 * Deduplication is per store, kind and normalised key, which is also the
 * database's unique constraint — so two people logging the same thing at the
 * same moment increment one row rather than racing to create two.
 */
export async function logRequest(input: {
  storeId: string;
  recordedById: string;
  kind: RequestKind;
  brandText: string | null;
  flavorText: string | null;
  productId: string | null;
}): Promise<{ id: string; count: number; deduped: boolean }> {
  const brandText = clampText(input.brandText);
  const flavorText = clampText(input.flavorText);
  const key = dedupKey({
    kind: input.kind,
    productId: input.productId,
    brandText,
    flavorText,
  });

  if (!key) throw new Error("A request needs a product or some text.");

  const existing = await prisma.customerRequest.findUnique({
    where: { storeId_kind_normalizedKey: { storeId: input.storeId, kind: input.kind, normalizedKey: key } },
    select: { id: true, count: true },
  });

  if (existing) {
    const updated = await prisma.customerRequest.update({
      where: { id: existing.id },
      data: { count: { increment: 1 }, lastSeenAt: new Date() },
      select: { id: true, count: true },
    });
    return { ...updated, deduped: true };
  }

  const created = await prisma.customerRequest.create({
    data: {
      storeId: input.storeId,
      recordedById: input.recordedById,
      kind: input.kind,
      brandText,
      flavorText,
      productId: input.productId,
      normalizedKey: key,
    },
    select: { id: true, count: true },
  });
  return { ...created, deduped: false };
}

/**
 * Requests from this store that look like what is being typed, so the UI can
 * offer "+1 till" instead of creating a near-duplicate.
 */
export async function findSimilar(input: {
  storeId: string;
  brandText: string | null;
  flavorText: string | null;
  productId: string | null;
}): Promise<SimilarRequest[]> {
  // Spelled out rather than spread: `input` also carries storeId, and a spread
  // would set productId twice.
  const key = dedupKey({
    kind: "NOT_STOCKED",
    productId: input.productId,
    brandText: input.brandText,
    flavorText: input.flavorText,
  });
  if (key.length < 2) return [];

  const rows = await prisma.customerRequest.findMany({
    where: { storeId: input.storeId },
    orderBy: { lastSeenAt: "desc" },
    take: 200,
    select: {
      id: true,
      brandText: true,
      flavorText: true,
      kind: true,
      count: true,
      lastSeenAt: true,
      normalizedKey: true,
    },
  });

  // Substring either way: typing "zyn" finds "zyncoolmint", and typing the
  // full thing finds a shorter existing entry.
  return rows
    .filter((row) => row.normalizedKey.includes(key) || key.includes(row.normalizedKey))
    .slice(0, 5)
    .map((row) => ({
      id: row.id,
      brandText: row.brandText,
      flavorText: row.flavorText,
      kind: toRequestKind(row.kind),
      count: row.count,
      lastSeenAt: row.lastSeenAt,
    }));
}

export async function incrementRequest(id: string): Promise<void> {
  await prisma.customerRequest.update({
    where: { id },
    data: { count: { increment: 1 }, lastSeenAt: new Date() },
  });
}

export type RankedRequest = {
  id: string;
  storeName: string;
  kind: RequestKind;
  brandText: string | null;
  flavorText: string | null;
  productLabel: string | null;
  count: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  status: RequestStatus;
  statusNote: string | null;
};

/** The admin ranking. `days` limits by last seen. */
export async function listRanked(filter: {
  days: number;
  storeId?: string;
  kind?: RequestKind;
}): Promise<RankedRequest[]> {
  const since = new Date(Date.now() - filter.days * 86_400_000);

  const rows = await prisma.customerRequest.findMany({
    where: {
      lastSeenAt: { gte: since },
      ...(filter.storeId ? { storeId: filter.storeId } : {}),
      ...(filter.kind ? { kind: filter.kind } : {}),
    },
    orderBy: [{ count: "desc" }, { lastSeenAt: "desc" }],
    select: {
      id: true,
      kind: true,
      brandText: true,
      flavorText: true,
      count: true,
      firstSeenAt: true,
      lastSeenAt: true,
      status: true,
      statusNote: true,
      store: { select: { name: true } },
      product: { select: { brand: true, flavor: true, strength: true, format: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    storeName: row.store.name,
    kind: toRequestKind(row.kind),
    brandText: row.brandText,
    flavorText: row.flavorText,
    productLabel: row.product
      ? `${row.product.brand} ${row.product.flavor} ${row.product.strength} ${row.product.format}`.trim()
      : null,
    count: row.count,
    firstSeenAt: row.firstSeenAt,
    lastSeenAt: row.lastSeenAt,
    status: toRequestStatus(row.status),
    statusNote: row.statusNote,
  }));
}

export async function setRequestStatus(input: {
  id: string;
  status: RequestStatus;
  note: string | null;
  productId: string | null;
}): Promise<void> {
  await prisma.customerRequest.update({
    where: { id: input.id },
    data: {
      status: input.status,
      statusNote: input.note,
      // Linking the catalog product is what "ADDED" means in practice.
      ...(input.productId ? { productId: input.productId } : {}),
    },
  });
}
