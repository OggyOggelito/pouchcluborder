import { prisma } from "@/lib/db";
import { isActive, isScheduled, pausesFor, toPauseScope, type PauseRow } from "@/lib/order-pause";

/**
 * Reading and writing order pauses.
 *
 * The live set is small — a handful of rows ever — so "which pauses apply"
 * loads them all and filters in src/lib/order-pause.ts rather than building a
 * query out of three optional scopes. One rule, one place, and testable
 * without a database.
 */
const SELECT = {
  id: true,
  scope: true,
  storeId: true,
  brandId: true,
  startsAt: true,
  endsAt: true,
  liftedAt: true,
  message: true,
  store: { select: { name: true } },
  brand: { select: { name: true } },
} as const;

type Raw = {
  id: string;
  scope: string;
  storeId: string | null;
  brandId: string | null;
  startsAt: Date;
  endsAt: Date | null;
  liftedAt: Date | null;
  message: string;
  store: { name: string } | null;
  brand: { name: string } | null;
};

function toRow(row: Raw): PauseRow {
  return {
    id: row.id,
    scope: toPauseScope(row.scope),
    storeId: row.storeId,
    brandId: row.brandId,
    storeName: row.store?.name ?? null,
    brandName: row.brand?.name ?? null,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    liftedAt: row.liftedAt,
    message: row.message,
  };
}

/** Everything that is not lifted yet: live now, or scheduled to start. */
export async function listOpenPauses(): Promise<PauseRow[]> {
  const rows = await prisma.orderPause.findMany({
    where: { liftedAt: null },
    orderBy: { startsAt: "asc" },
    select: SELECT,
  });
  return rows.map(toRow);
}

export async function listPauseHistory(limit = 50): Promise<
  (PauseRow & { createdAt: Date; byName: string | null; liftedByName: string | null })[]
> {
  const rows = await prisma.orderPause.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      ...SELECT,
      createdAt: true,
      createdBy: { select: { name: true, email: true } },
      liftedBy: { select: { name: true, email: true } },
    },
  });

  return rows.map((row) => ({
    ...toRow(row),
    createdAt: row.createdAt,
    byName: row.createdBy?.name ?? row.createdBy?.email ?? null,
    liftedByName: row.liftedBy?.name ?? row.liftedBy?.email ?? null,
  }));
}

/**
 * Which pauses stop this order.
 *
 * `brandIds` is the basket. Without it the answer is "is ordering paused for
 * this shop at all", which is what a banner asks; with it, a brand pause only
 * bites when the basket actually contains that brand.
 */
export async function activePausesFor(input: {
  storeId: string;
  brandIds?: string[];
  now?: Date;
}): Promise<PauseRow[]> {
  const pauses = await listOpenPauses();
  return pausesFor({ pauses, storeId: input.storeId, brandIds: input.brandIds, now: input.now });
}

/** What the order screen and the Idag card show, in one read. */
export async function pauseBanner(input: {
  storeIds: string[];
  now?: Date;
}): Promise<{ active: PauseRow[]; scheduled: PauseRow[] }> {
  const now = input.now ?? new Date();
  const pauses = await listOpenPauses();

  const active = pauses.filter(
    (pause) =>
      isActive(pause, now) &&
      (pause.scope !== "STORE" || (pause.storeId !== null && input.storeIds.includes(pause.storeId)))
  );
  const scheduled = pauses.filter(
    (pause) =>
      isScheduled(pause, now) &&
      (pause.scope !== "STORE" || (pause.storeId !== null && input.storeIds.includes(pause.storeId)))
  );

  return { active, scheduled };
}

export async function createPause(input: {
  scope: string;
  storeId: string | null;
  brandId: string | null;
  startsAt: Date;
  endsAt: Date | null;
  message: string;
  createdById: string;
}): Promise<string> {
  const pause = await prisma.orderPause.create({
    data: {
      scope: input.scope,
      storeId: input.scope === "STORE" ? input.storeId : null,
      brandId: input.scope === "BRAND" ? input.brandId : null,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      message: input.message.trim(),
      createdById: input.createdById,
    },
    select: { id: true },
  });
  return pause.id;
}

/** Lifting records who and when. The row stays, so the history is readable. */
export async function liftPause(input: { id: string; userId: string }): Promise<void> {
  await prisma.orderPause.updateMany({
    where: { id: input.id, liftedAt: null },
    data: { liftedAt: new Date(), liftedById: input.userId },
  });
}

/** An admin pushing an order through. The reason is required by the caller. */
export async function recordOverride(input: {
  pauseId: string;
  userId: string;
  storeId: string;
  orderId: string | null;
  reason: string;
}): Promise<void> {
  await prisma.orderPauseOverride.create({ data: input });
}

export type OverrideRow = {
  id: string;
  reason: string;
  orderId: string | null;
  createdAt: Date;
  byName: string | null;
};

export async function listOverrides(pauseId: string): Promise<OverrideRow[]> {
  const rows = await prisma.orderPauseOverride.findMany({
    where: { pauseId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      reason: true,
      orderId: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    reason: row.reason,
    orderId: row.orderId,
    createdAt: row.createdAt,
    byName: row.user?.name ?? row.user?.email ?? null,
  }));
}
