import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import {
  MAX_DEMO_NOTE_LENGTH,
  SLOT_HOLDING,
  canTransition,
  holdsSlot,
  storeOptionsFor,
  toDemoStatus,
  type DemoStatus,
  type StoreOption,
} from "@/lib/demo-days";
import { effectiveHoursFor, isOpen } from "@/lib/schedule/opening-hours";
import { listExceptions, listOpeningHours } from "@/lib/repositories/opening-hours";

/**
 * Demo-day bookings.
 *
 * The slot rule — at most one live demo day per shop per day — is enforced in
 * a transaction rather than by a unique constraint. A declined or cancelled
 * booking must free the day, and "unique unless the status is one of these
 * three" is not something a constraint can say.
 */
export class DemoDayError extends Error {}

/** Whichever supplier asks, this is all a blocked store says. */
export async function storeOptionsForDate(date: string): Promise<StoreOption[]> {
  const [stores, taken] = await Promise.all([
    prisma.store.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.demoDayBooking.findMany({
      where: { date, status: { in: SLOT_HOLDING } },
      select: { storeId: true },
    }),
  ]);

  const blocked = new Set(taken.map((row) => row.storeId));

  const resolved = await Promise.all(
    stores.map(async (store) => {
      const [hours, exceptions] = await Promise.all([
        listOpeningHours(store.id),
        listExceptions(store.id, { from: date, to: date }),
      ]);
      const day = effectiveHoursFor(date, hours, exceptions);

      return {
        storeId: store.id,
        storeName: store.name,
        closed: day.closed,
        hoursMissing: day.source === "missing",
        opensAt: day.opensAt,
        closesAt: day.closesAt,
        taken: blocked.has(store.id),
      };
    })
  );

  return storeOptionsFor({ stores: resolved });
}

export type CreateResult = {
  groupId: string;
  created: { storeId: string; storeName: string }[];
  skipped: { storeName: string; reason: string }[];
};

/**
 * Books one date in one or more stores.
 *
 * Everything is decided inside one transaction: the options a supplier saw are
 * a few seconds old, and two suppliers pressing "boka" at the same moment must
 * not both get the day. A store that cannot be taken is reported back with its
 * reason rather than failing the whole request — three shops asked for, two
 * booked, is a useful answer.
 */
export async function createBookings(input: {
  brandId: string;
  supplierUserId: string;
  date: string;
  storeIds: string[];
  note: string | null;
}): Promise<CreateResult> {
  if (input.storeIds.length === 0) throw new DemoDayError("Välj minst en butik.");

  const note = (input.note ?? "").trim();
  if (note.length > MAX_DEMO_NOTE_LENGTH) {
    throw new DemoDayError(`Meddelandet får vara högst ${MAX_DEMO_NOTE_LENGTH} tecken.`);
  }

  const options = await storeOptionsForDate(input.date);
  const byId = new Map(options.map((option) => [option.storeId, option]));
  const groupId = randomUUID();

  return prisma.$transaction(async (tx) => {
    // Re-read inside the transaction. This is the check that counts; the one
    // above only decides what the form showed.
    const taken = await tx.demoDayBooking.findMany({
      where: { date: input.date, status: { in: SLOT_HOLDING }, storeId: { in: input.storeIds } },
      select: { storeId: true },
    });
    const blocked = new Set(taken.map((row) => row.storeId));

    const created: CreateResult["created"] = [];
    const skipped: CreateResult["skipped"] = [];

    for (const storeId of input.storeIds) {
      const option = byId.get(storeId);
      if (!option) {
        skipped.push({ storeName: storeId, reason: "Okänd butik" });
        continue;
      }
      if (blocked.has(storeId)) {
        skipped.push({ storeName: option.storeName, reason: "Redan bokad" });
        continue;
      }
      if (option.blockedReason) {
        skipped.push({ storeName: option.storeName, reason: option.blockedReason });
        continue;
      }

      await tx.demoDayBooking.create({
        data: {
          groupId,
          brandId: input.brandId,
          supplierUserId: input.supplierUserId,
          storeId,
          date: input.date,
          // The shop's own opening hours, unless it has none — in which case
          // the option would have been blocked before reaching here.
          startsAt: option.opensAt ?? "10:00",
          endsAt: option.closesAt ?? "18:00",
          note: note || null,
          status: "REQUESTED",
        },
      });
      created.push({ storeId, storeName: option.storeName });
    }

    if (created.length === 0) {
      throw new DemoDayError(
        skipped.map((row) => `${row.storeName}: ${row.reason}`).join(". ") ||
          "Ingen butik kunde bokas."
      );
    }

    return { groupId, created, skipped };
  });
}

export type BookingView = {
  id: string;
  groupId: string;
  status: DemoStatus;
  date: string;
  startsAt: string;
  endsAt: string;
  note: string | null;
  decisionNote: string | null;
  decidedAt: Date | null;
  createdAt: Date;
  store: { id: string; name: string };
  brand: { id: string; name: string };
};

const BOOKING_SELECT = {
  id: true,
  groupId: true,
  status: true,
  date: true,
  startsAt: true,
  endsAt: true,
  note: true,
  decisionNote: true,
  decidedAt: true,
  createdAt: true,
  store: { select: { id: true, name: true } },
  brand: { select: { id: true, name: true } },
} as const;

type RawBooking = Omit<BookingView, "status"> & { status: string };

function toView(row: RawBooking): BookingView {
  return { ...row, status: toDemoStatus(row.status) };
}

/** A supplier's own bookings, scoped by brand and by nothing else. */
export async function listBookingsForBrand(input: {
  brandId: string;
  from?: string;
}): Promise<BookingView[]> {
  const rows = await prisma.demoDayBooking.findMany({
    where: { brandId: input.brandId, ...(input.from ? { date: { gte: input.from } } : {}) },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    select: BOOKING_SELECT,
  });
  return rows.map(toView);
}

export async function getBooking(id: string): Promise<BookingView | null> {
  const row = await prisma.demoDayBooking.findUnique({ where: { id }, select: BOOKING_SELECT });
  return row ? toView(row) : null;
}

/** Upcoming demo days in these shops — what staff need to be ready. */
export async function listBookingsForStores(input: {
  storeIds: string[];
  from: string;
  status?: DemoStatus[];
}): Promise<BookingView[]> {
  if (input.storeIds.length === 0) return [];

  const rows = await prisma.demoDayBooking.findMany({
    where: {
      storeId: { in: input.storeIds },
      date: { gte: input.from },
      ...(input.status ? { status: { in: input.status } } : {}),
    },
    orderBy: [{ date: "asc" }, { store: { name: "asc" } }],
    select: BOOKING_SELECT,
  });
  return rows.map(toView);
}

/** The admin list: every store, filterable. */
export async function listAllBookings(input: {
  from?: string;
  to?: string;
  storeId?: string | null;
  brandId?: string | null;
  status?: DemoStatus | null;
}): Promise<BookingView[]> {
  const rows = await prisma.demoDayBooking.findMany({
    where: {
      ...(input.from || input.to
        ? { date: { ...(input.from ? { gte: input.from } : {}), ...(input.to ? { lte: input.to } : {}) } }
        : {}),
      ...(input.storeId ? { storeId: input.storeId } : {}),
      ...(input.brandId ? { brandId: input.brandId } : {}),
      ...(input.status ? { status: input.status } : {}),
    },
    orderBy: [{ date: "asc" }, { store: { name: "asc" } }],
    take: 500,
    select: BOOKING_SELECT,
  });
  return rows.map(toView);
}

export class BookingConflictError extends DemoDayError {}

/**
 * Confirming or declining one store's slot.
 *
 * Conditional on the status it was read at, so two people answering at once
 * cannot both land — and confirming re-checks the slot, because a day can have
 * been taken by another brand since this one was requested.
 */
export async function decide(input: {
  id: string;
  to: Extract<DemoStatus, "CONFIRMED" | "DECLINED" | "CANCELLED_BY_STORE">;
  userId: string;
  note: string | null;
}): Promise<void> {
  const outcome = await prisma.$transaction(async (tx) => {
    const booking = await tx.demoDayBooking.findUnique({
      where: { id: input.id },
      select: { id: true, status: true, storeId: true, date: true },
    });
    if (!booking) return { kind: "unknown" as const };

    const from = toDemoStatus(booking.status);
    if (!canTransition(from, input.to)) return { kind: "stale" as const, status: from };

    if (input.to === "CONFIRMED") {
      const clash = await tx.demoDayBooking.findFirst({
        where: {
          storeId: booking.storeId,
          date: booking.date,
          status: "CONFIRMED",
          id: { not: booking.id },
        },
        select: { id: true },
      });
      if (clash) return { kind: "conflict" as const };
    }

    const moved = await tx.demoDayBooking.updateMany({
      where: { id: input.id, status: booking.status },
      data: {
        status: input.to,
        decidedById: input.userId,
        decidedAt: new Date(),
        decisionNote: input.note?.trim() || null,
      },
    });
    if (moved.count === 0) return { kind: "stale" as const, status: from };

    return { kind: "ok" as const };
  });

  if (outcome.kind === "unknown") throw new DemoDayError("Okänd bokning.");
  if (outcome.kind === "conflict") {
    throw new BookingConflictError("Butiken har redan en bekräftad demodag den dagen.");
  }
  if (outcome.kind === "stale") {
    throw new DemoDayError("Bokningen är redan besvarad.");
  }
}

/** The supplier pulling out. Scoped by brand, so one cannot cancel another's. */
export async function cancelBySupplier(input: {
  id: string;
  brandId: string;
}): Promise<boolean> {
  const booking = await prisma.demoDayBooking.findFirst({
    where: { id: input.id, brandId: input.brandId },
    select: { status: true },
  });
  if (!booking || !holdsSlot(toDemoStatus(booking.status))) return false;

  const updated = await prisma.demoDayBooking.updateMany({
    where: { id: input.id, brandId: input.brandId, status: booking.status },
    data: { status: "CANCELLED_BY_SUPPLIER", decidedAt: new Date() },
  });
  return updated.count > 0;
}

/** "X demodagar väntar på svar" — the staff queue. */
export async function countPendingForStores(storeIds: string[]): Promise<number> {
  if (storeIds.length === 0) return 0;
  return prisma.demoDayBooking.count({
    where: { storeId: { in: storeIds }, status: "REQUESTED" },
  });
}

/** Decisions a supplier has not looked at yet. There is no email to send. */
export async function countNewDecisions(input: {
  brandId: string;
  since: Date | null;
}): Promise<number> {
  return prisma.demoDayBooking.count({
    where: {
      brandId: input.brandId,
      decidedAt: input.since ? { gt: input.since } : { not: null },
      status: { in: ["CONFIRMED", "DECLINED", "CANCELLED_BY_STORE"] },
    },
  });
}

/** Everyone with access to the store, for the in-app notification. */
export async function staffForStore(storeId: string): Promise<string[]> {
  const rows = await prisma.storeAccess.findMany({
    where: { storeId },
    select: { userId: true },
  });
  return rows.map((row) => row.userId);
}
