import { prisma } from "@/lib/db";
import { overlaps } from "@/lib/schedule/time";
import {
  canTransition,
  toExtraShiftStatus,
  type ExtraShiftStatus,
  type ExtraShiftTab,
} from "@/lib/schedule/extra-shifts";
import { validateShift } from "@/lib/schedule/week";
import { recordChange } from "@/lib/repositories/schedule-week";

export class ExtraShiftError extends Error {}

/** The person picked up another shift between the ask and the answer. */
export class DoubleBookedError extends ExtraShiftError {}

/** Somebody already answered — or withdrew — this request. */
export class AlreadyAnsweredError extends ExtraShiftError {
  constructor(public readonly status: ExtraShiftStatus) {
    super(`Already ${status}`);
  }
}

export type ExtraShiftView = {
  id: string;
  status: ExtraShiftStatus;
  date: string;
  startsAt: string;
  endsAt: string;
  note: string | null;
  createdAt: Date;
  requestingStore: { id: string; name: string };
  employee: { id: string; name: string; homeStore: { id: string; name: string } };
  createdByName: string | null;
  /** Set once accepted. */
  shiftId: string | null;
  events: { id: string; type: string; detail: string | null; at: Date; byName: string | null }[];
};

const REQUEST_SELECT = {
  id: true,
  status: true,
  date: true,
  startsAt: true,
  endsAt: true,
  note: true,
  createdAt: true,
  requestingStore: { select: { id: true, name: true } },
  employee: {
    select: { id: true, name: true, homeStore: { select: { id: true, name: true } } },
  },
  createdBy: { select: { name: true, email: true } },
  shift: { select: { id: true } },
  events: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      type: true,
      detail: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  },
} as const;

type RawRequest = {
  id: string;
  status: string;
  date: string;
  startsAt: string;
  endsAt: string;
  note: string | null;
  createdAt: Date;
  requestingStore: { id: string; name: string };
  employee: { id: string; name: string; homeStore: { id: string; name: string } };
  createdBy: { name: string | null; email: string } | null;
  shift: { id: string } | null;
  events: {
    id: string;
    type: string;
    detail: string | null;
    createdAt: Date;
    user: { name: string | null; email: string } | null;
  }[];
};

function toView(row: RawRequest): ExtraShiftView {
  return {
    id: row.id,
    status: toExtraShiftStatus(row.status),
    date: row.date,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    note: row.note,
    createdAt: row.createdAt,
    requestingStore: row.requestingStore,
    employee: row.employee,
    createdByName: row.createdBy?.name ?? row.createdBy?.email ?? null,
    shiftId: row.shift?.id ?? null,
    events: row.events.map((event) => ({
      id: event.id,
      type: event.type,
      detail: event.detail,
      at: event.createdAt,
      byName: event.user?.name ?? event.user?.email ?? null,
    })),
  };
}

export async function getRequest(id: string): Promise<ExtraShiftView | null> {
  const row = await prisma.extraShiftRequest.findUnique({ where: { id }, select: REQUEST_SELECT });
  return row ? toView(row) : null;
}

export async function createRequest(input: {
  requestingStoreId: string;
  employeeId: string;
  date: string;
  startsAt: string;
  endsAt: string;
  note: string | null;
  createdById: string;
}): Promise<string> {
  // The times are a shift in waiting, so they go through the same check.
  const validation = validateShift({
    employeeId: input.employeeId,
    date: input.date,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
  });
  if (!validation.ok) throw new ExtraShiftError(validation.errors.join(" "));

  const employee = await prisma.employee.findUnique({
    where: { id: input.employeeId },
    select: { id: true, active: true, openToExtraShifts: true, homeStoreId: true },
  });
  if (!employee) throw new ExtraShiftError("Okänd medarbetare.");
  if (!employee.active) throw new ExtraShiftError("Medarbetaren är inaktiv.");

  // Asked before consent, because it is the more useful answer: borrowing
  // your own employee is not something to ask permission for, it is a shift
  // to type in.
  if (employee.homeStoreId === input.requestingStoreId) {
    throw new ExtraShiftError("Medarbetaren hör redan till butiken — lägg in passet direkt.");
  }

  // Consent is checked again here, not only in the list that offered them:
  // the list is a few seconds old and this is the request that commits.
  if (!employee.openToExtraShifts) {
    throw new ExtraShiftError("Medarbetaren är inte öppen för extrapass.");
  }

  const duplicate = await prisma.extraShiftRequest.findFirst({
    where: {
      requestingStoreId: input.requestingStoreId,
      employeeId: input.employeeId,
      date: input.date,
      status: "REQUESTED",
    },
    select: { id: true },
  });
  if (duplicate) throw new ExtraShiftError("En förfrågan för den dagen är redan skickad.");

  const request = await prisma.extraShiftRequest.create({
    data: {
      requestingStoreId: input.requestingStoreId,
      employeeId: input.employeeId,
      date: input.date,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      note: input.note,
      createdById: input.createdById,
      status: "REQUESTED",
      events: { create: [{ type: "CREATED", userId: input.createdById }] },
    },
    select: { id: true },
  });
  return request.id;
}

/**
 * Accepts a request and creates the shift, or fails without doing either.
 *
 * Two races to close, both inside one transaction:
 *
 * 1. Two answers at once. The status is moved with a conditional update that
 *    only matches a request still REQUESTED, so the second one matches zero
 *    rows and is told the request is already dealt with.
 * 2. A double booking. The employee's shifts for that date are read inside the
 *    same transaction and checked for an overlap. A clash returns before
 *    anything is written, so the request stays answerable and nobody ends up
 *    rota'd into two shops.
 *
 * Nothing throws inside the transaction. A refusal is a returned value and the
 * throw happens after it has closed — rolling back by exception leaves the one
 * SQLite connection in the hands of whatever threw it.
 */
export async function acceptRequest(input: {
  requestId: string;
  userId: string;
  decidingStoreName: string;
}): Promise<{ shiftId: string }> {
  const outcome = await prisma.$transaction(async (tx) => {
    const request = await tx.extraShiftRequest.findUnique({
      where: { id: input.requestId },
      select: {
        id: true,
        status: true,
        date: true,
        startsAt: true,
        endsAt: true,
        note: true,
        employeeId: true,
        requestingStoreId: true,
        employee: { select: { name: true, active: true } },
      },
    });
    if (!request) return { kind: "unknown" as const };
    if (!request.employee.active) return { kind: "inactive" as const };

    const status = toExtraShiftStatus(request.status);
    if (status !== "REQUESTED") return { kind: "answered" as const, status };

    // Read the clashes before claiming anything, inside the same transaction:
    // the read and the write are then one unit, so a shift that lands in
    // between is either seen here or blocked behind this transaction.
    const sameDay = await tx.scheduleShift.findMany({
      where: { employeeId: request.employeeId, date: request.date },
      select: { startsAt: true, endsAt: true },
    });
    if (sameDay.some((shift) => overlaps(shift, request))) {
      return { kind: "double-booked" as const };
    }

    // The conditional update is what closes the two-answers-at-once race: the
    // second one matches zero rows and is told the request is already dealt
    // with.
    const claimed = await tx.extraShiftRequest.updateMany({
      where: { id: input.requestId, status: "REQUESTED" },
      data: { status: "ACCEPTED" },
    });
    if (claimed.count === 0) return { kind: "answered" as const, status };

    const shift = await tx.scheduleShift.create({
      data: {
        employeeId: request.employeeId,
        storeId: request.requestingStoreId,
        date: request.date,
        startsAt: request.startsAt,
        endsAt: request.endsAt,
        note: request.note,
        createdById: input.userId,
        extraShiftRequestId: request.id,
      },
      select: { id: true },
    });

    await tx.extraShiftEvent.create({
      data: {
        requestId: request.id,
        type: "ACCEPTED",
        userId: input.userId,
        detail: input.decidingStoreName,
      },
    });

    return { kind: "ok" as const, shiftId: shift.id };
  });

  switch (outcome.kind) {
    case "ok":
      return { shiftId: outcome.shiftId };
    case "unknown":
      throw new ExtraShiftError("Okänd förfrågan.");
    case "inactive":
      throw new ExtraShiftError("Medarbetaren är inaktiv.");
    case "double-booked":
      throw new DoubleBookedError("Medarbetaren har ett krockande pass.");
    case "answered":
      throw new AlreadyAnsweredError(outcome.status);
  }
}

/**
 * DECLINED and CANCELLED both come through here.
 *
 * One transaction, like `acceptRequest`, for two reasons. The status move and
 * its timeline row belong together — and SQLite gives us a single connection,
 * so a loose sequence of queries racing an interactive transaction can queue
 * behind each other and deadlock. Everything that writes a request writes it
 * the same way.
 */
export async function answerRequest(input: {
  requestId: string;
  to: Extract<ExtraShiftStatus, "DECLINED" | "CANCELLED">;
  userId: string;
  detail?: string | null;
}): Promise<void> {
  const outcome = await prisma.$transaction(async (tx) => {
    const request = await tx.extraShiftRequest.findUnique({
      where: { id: input.requestId },
      select: { status: true },
    });
    if (!request) return { kind: "unknown" as const };

    const from = toExtraShiftStatus(request.status);
    if (!canTransition(from, input.to)) return { kind: "answered" as const, status: from };

    const moved = await tx.extraShiftRequest.updateMany({
      where: { id: input.requestId, status: from },
      data: { status: input.to },
    });
    if (moved.count === 0) return { kind: "answered" as const, status: from };

    await tx.extraShiftEvent.create({
      data: {
        requestId: input.requestId,
        type: input.to,
        userId: input.userId,
        detail: input.detail ?? null,
      },
    });
    return { kind: "moved" as const };
  });

  if (outcome.kind === "unknown") throw new ExtraShiftError("Okänd förfrågan.");
  if (outcome.kind === "answered") throw new AlreadyAnsweredError(outcome.status);
}

/** Writes the accepted shift into the asking store's change trail. */
export async function recordAcceptedShift(input: {
  requestId: string;
  userId: string;
}): Promise<void> {
  const request = await prisma.extraShiftRequest.findUnique({
    where: { id: input.requestId },
    select: {
      date: true,
      startsAt: true,
      endsAt: true,
      requestingStoreId: true,
      employee: { select: { name: true, homeStore: { select: { name: true } } } },
    },
  });
  if (!request) return;

  await recordChange({
    storeId: request.requestingStoreId,
    date: request.date,
    type: "EXTRA_SHIFT",
    userId: input.userId,
    detail: `${request.employee.name} (${request.employee.homeStore.name}) · extrapass ${request.startsAt}–${request.endsAt}`,
  });
}

export type ExtraShiftListRow = {
  id: string;
  status: ExtraShiftStatus;
  date: string;
  startsAt: string;
  endsAt: string;
  employeeName: string;
  homeStoreName: string;
  requestingStoreName: string;
  createdAt: Date;
};

/**
 * The three tabs.
 *
 * "Inkomna" is a request about one of *our* employees — our call to make.
 * "Skickade" is one we sent about somebody else's. "Historik" is everything
 * answered, either way round.
 */
export async function listRequests(input: {
  storeIds: string[];
  tab: ExtraShiftTab;
}): Promise<ExtraShiftListRow[]> {
  if (input.storeIds.length === 0) return [];

  const incoming = { employee: { homeStoreId: { in: input.storeIds } } };
  const outgoing = { requestingStoreId: { in: input.storeIds } };

  const where =
    input.tab === "incoming"
      ? { ...incoming, status: "REQUESTED" }
      : input.tab === "outgoing"
        ? { ...outgoing, status: "REQUESTED" }
        : { OR: [incoming, outgoing], status: { not: "REQUESTED" } };

  const rows = await prisma.extraShiftRequest.findMany({
    where,
    orderBy: [{ date: "asc" }, { createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      status: true,
      date: true,
      startsAt: true,
      endsAt: true,
      createdAt: true,
      requestingStore: { select: { name: true } },
      employee: { select: { name: true, homeStore: { select: { name: true } } } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    status: toExtraShiftStatus(row.status),
    date: row.date,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    employeeName: row.employee.name,
    homeStoreName: row.employee.homeStore.name,
    requestingStoreName: row.requestingStore.name,
    createdAt: row.createdAt,
  }));
}

/** The "svara på extrapass" count for the Idag card. */
export async function countIncomingRequests(storeIds: string[]): Promise<number> {
  if (storeIds.length === 0) return 0;
  return prisma.extraShiftRequest.count({
    where: { status: "REQUESTED", employee: { homeStoreId: { in: storeIds } } },
  });
}
