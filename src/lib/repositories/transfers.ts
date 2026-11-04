import { prisma } from "@/lib/db";
import {
  canTransition,
  eligibleAccepterIds,
  toTransferStatus,
  toTransferUnit,
  type TransferStatus,
  type TransferUnit,
} from "@/lib/transfers";

export type TransferLineInput = { productId: string; quantity: number; unit: TransferUnit };

export class TransferConflictError extends Error {
  constructor(public readonly acceptedByStoreName: string) {
    super(`Already accepted by ${acceptedByStoreName}`);
  }
}

export class TransferTransitionError extends Error {}

export type TransferView = {
  id: string;
  status: TransferStatus;
  note: string | null;
  createdAt: Date;
  requestingStore: { id: string; name: string };
  targetStore: { id: string; name: string } | null;
  acceptingStore: { id: string; name: string } | null;
  createdByName: string | null;
  lines: {
    id: string;
    quantity: number;
    unit: TransferUnit;
    brand: string;
    flavor: string;
    strength: string;
    format: string;
  }[];
  events: { id: string; type: string; detail: string | null; at: Date; userName: string | null }[];
};

const TRANSFER_SELECT = {
  id: true,
  status: true,
  note: true,
  createdAt: true,
  requestingStore: { select: { id: true, name: true } },
  targetStore: { select: { id: true, name: true } },
  acceptingStore: { select: { id: true, name: true } },
  createdBy: { select: { name: true, email: true } },
  lines: {
    select: {
      id: true,
      quantity: true,
      unit: true,
      product: { select: { brand: true, flavor: true, strength: true, format: true } },
    },
  },
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

type RawTransfer = {
  id: string;
  status: string;
  note: string | null;
  createdAt: Date;
  requestingStore: { id: string; name: string };
  targetStore: { id: string; name: string } | null;
  acceptingStore: { id: string; name: string } | null;
  createdBy: { name: string | null; email: string } | null;
  lines: {
    id: string;
    quantity: number;
    unit: string;
    product: { brand: string; flavor: string; strength: string; format: string };
  }[];
  events: {
    id: string;
    type: string;
    detail: string | null;
    createdAt: Date;
    user: { name: string | null; email: string } | null;
  }[];
};

function toView(row: RawTransfer): TransferView {
  return {
    id: row.id,
    status: toTransferStatus(row.status),
    note: row.note,
    createdAt: row.createdAt,
    requestingStore: row.requestingStore,
    targetStore: row.targetStore,
    acceptingStore: row.acceptingStore,
    createdByName: row.createdBy?.name ?? row.createdBy?.email ?? null,
    lines: row.lines.map((line) => ({
      id: line.id,
      quantity: line.quantity,
      unit: toTransferUnit(line.unit),
      brand: line.product.brand,
      flavor: line.product.flavor,
      strength: line.product.strength,
      format: line.product.format,
    })),
    events: row.events.map((event) => ({
      id: event.id,
      type: event.type,
      detail: event.detail,
      at: event.createdAt,
      userName: event.user?.name ?? event.user?.email ?? null,
    })),
  };
}

export async function createTransfer(input: {
  requestingStoreId: string;
  targetStoreId: string | null;
  createdById: string;
  note: string | null;
  lines: TransferLineInput[];
}): Promise<string> {
  const lines = input.lines.filter((line) => line.quantity > 0);
  if (lines.length === 0) throw new TransferTransitionError("A transfer needs at least one line.");

  const transfer = await prisma.stockTransfer.create({
    data: {
      requestingStoreId: input.requestingStoreId,
      targetStoreId: input.targetStoreId,
      createdById: input.createdById,
      note: input.note,
      status: "REQUESTED",
      lines: {
        create: lines.map((line) => ({
          productId: line.productId,
          quantity: Math.trunc(line.quantity),
          // Stored explicitly — "two" means very different things per unit.
          unit: line.unit,
        })),
      },
      events: {
        create: [{ type: "CREATED", userId: input.createdById }],
      },
    },
    select: { id: true },
  });

  return transfer.id;
}

/**
 * Accepts a transfer, and loses cleanly if another store got there first.
 *
 * The race is closed by a conditional update: the row is only written when it
 * is still REQUESTED and still has no accepting store. Two stores pressing
 * accept at the same moment therefore cannot both succeed — the second update
 * matches zero rows and we report who won.
 */
export async function acceptTransfer(input: {
  transferId: string;
  acceptingStoreId: string;
  userId: string;
}): Promise<void> {
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.stockTransfer.updateMany({
      where: {
        id: input.transferId,
        status: "REQUESTED",
        acceptingStoreId: null,
      },
      data: {
        status: "ACCEPTED",
        acceptingStoreId: input.acceptingStoreId,
      },
    });

    if (updated.count === 0) return { won: false as const };

    const store = await tx.store.findUnique({
      where: { id: input.acceptingStoreId },
      select: { name: true },
    });

    await tx.stockTransferEvent.create({
      data: {
        transferId: input.transferId,
        type: "ACCEPTED",
        userId: input.userId,
        detail: store?.name ?? null,
      },
    });

    return { won: true as const };
  });

  if (result.won) return;

  const current = await prisma.stockTransfer.findUnique({
    where: { id: input.transferId },
    select: { acceptingStore: { select: { name: true } }, status: true },
  });
  throw new TransferConflictError(current?.acceptingStore?.name ?? "en annan butik");
}

/** Any status move other than accepting, with the transition rules enforced. */
export async function moveTransfer(input: {
  transferId: string;
  to: TransferStatus;
  userId: string;
  detail?: string | null;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const current = await tx.stockTransfer.findUnique({
      where: { id: input.transferId },
      select: { status: true },
    });
    if (!current) throw new TransferTransitionError("Unknown transfer.");

    const from = toTransferStatus(current.status);
    if (!canTransition(from, input.to)) {
      throw new TransferTransitionError(`Cannot move a transfer from ${from} to ${input.to}.`);
    }

    // Guarded on the status we just read, so a concurrent change loses.
    const updated = await tx.stockTransfer.updateMany({
      where: { id: input.transferId, status: from },
      data: { status: input.to },
    });
    if (updated.count === 0) {
      throw new TransferTransitionError("The transfer changed while you were looking at it.");
    }

    await tx.stockTransferEvent.create({
      data: {
        transferId: input.transferId,
        type: input.to,
        userId: input.userId,
        detail: input.detail ?? null,
      },
    });
  });
}

export async function getTransfer(id: string): Promise<TransferView | null> {
  const row = await prisma.stockTransfer.findUnique({ where: { id }, select: TRANSFER_SELECT });
  return row ? toView(row as RawTransfer) : null;
}

/** Stores that may accept a given transfer, from the region rules. */
export async function accepterIdsFor(transferId: string): Promise<string[]> {
  const transfer = await prisma.stockTransfer.findUnique({
    where: { id: transferId },
    select: {
      requestingStoreId: true,
      targetStoreId: true,
      requestingStore: { select: { region: true } },
    },
  });
  if (!transfer) return [];

  const stores = await prisma.store.findMany({ select: { id: true, region: true } });

  return eligibleAccepterIds({
    requestingStoreId: transfer.requestingStoreId,
    targetStoreId: transfer.targetStoreId,
    requestingRegion: transfer.requestingStore.region,
    stores,
  });
}

export type TransferTab = "incoming" | "outgoing" | "history";

/**
 * Transfers visible to a set of stores.
 *
 * "Incoming" is deliberately computed from the region rules, not just the
 * target column, so an open request reaches the rest of its region.
 */
export async function listTransfersForStores(
  storeIds: string[],
  tab: TransferTab
): Promise<TransferView[]> {
  if (storeIds.length === 0) return [];

  const stores = await prisma.store.findMany({ select: { id: true, region: true } });
  const regions = new Set(
    stores.filter((store) => storeIds.includes(store.id)).map((store) => store.region)
  );

  const open: Record<string, unknown> = { status: { in: ["REQUESTED", "ACCEPTED", "SENT"] } };

  const where =
    tab === "outgoing"
      ? { requestingStoreId: { in: storeIds }, ...open }
      : tab === "incoming"
        ? {
            ...open,
            requestingStoreId: { notIn: storeIds },
            OR: [
              { targetStoreId: { in: storeIds } },
              // Open requests from our own region.
              {
                targetStoreId: null,
                requestingStore: { region: { in: [...regions].filter(Boolean) as string[] } },
              },
              { acceptingStoreId: { in: storeIds } },
            ],
          }
        : {
            status: { in: ["RECEIVED", "DECLINED", "CANCELLED"] },
            OR: [
              { requestingStoreId: { in: storeIds } },
              { targetStoreId: { in: storeIds } },
              { acceptingStoreId: { in: storeIds } },
            ],
          };

  const rows = await prisma.stockTransfer.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: TRANSFER_SELECT,
  });

  return rows.map((row) => toView(row as RawTransfer));
}

/** Every transfer — admin only. */
export async function listAllTransfers(filter: {
  status?: TransferStatus;
  storeId?: string;
}): Promise<TransferView[]> {
  const rows = await prisma.stockTransfer.findMany({
    where: {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.storeId
        ? {
            OR: [
              { requestingStoreId: filter.storeId },
              { targetStoreId: filter.storeId },
              { acceptingStoreId: filter.storeId },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: TRANSFER_SELECT,
  });
  return rows.map((row) => toView(row as RawTransfer));
}
