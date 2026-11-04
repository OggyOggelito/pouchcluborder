import { prisma } from "@/lib/db";
import {
  mayOverwrite,
  parseLines,
  serializeLines,
  type DraftLines,
  type DraftSaveResult,
} from "@/lib/order-drafts";

export type DraftRecord = {
  lines: DraftLines;
  note: string | null;
  version: number;
  updatedAt: Date;
  storeId: string;
  storeName: string;
};

export async function getDraft(userId: string, storeId: string): Promise<DraftRecord | null> {
  const draft = await prisma.orderDraft.findUnique({
    where: { userId_storeId: { userId, storeId } },
    select: {
      lines: true,
      note: true,
      version: true,
      updatedAt: true,
      storeId: true,
      store: { select: { name: true } },
    },
  });
  if (!draft) return null;

  return {
    lines: parseLines(draft.lines),
    note: draft.note,
    version: draft.version,
    updatedAt: draft.updatedAt,
    storeId: draft.storeId,
    storeName: draft.store.name,
  };
}

/** Every store this person has an unfinished order for, for the home card. */
export async function listDraftsForUser(userId: string): Promise<DraftRecord[]> {
  const drafts = await prisma.orderDraft.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      lines: true,
      note: true,
      version: true,
      updatedAt: true,
      storeId: true,
      store: { select: { name: true } },
    },
  });

  return drafts
    .map((draft) => ({
      lines: parseLines(draft.lines),
      note: draft.note,
      version: draft.version,
      updatedAt: draft.updatedAt,
      storeId: draft.storeId,
      storeName: draft.store.name,
    }))
    .filter((draft) => Object.keys(draft.lines).length > 0);
}

/**
 * Writes a draft, unless it changed elsewhere since the client last saw it.
 *
 * The version check and the write are one transaction, so two tabs saving at
 * the same instant cannot both believe they won.
 */
export async function saveDraft(input: {
  userId: string;
  storeId: string;
  lines: DraftLines;
  note: string | null;
  clientVersion: number;
}): Promise<DraftSaveResult> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.orderDraft.findUnique({
      where: { userId_storeId: { userId: input.userId, storeId: input.storeId } },
      select: { version: true },
    });

    if (existing && !mayOverwrite(input.clientVersion, existing.version)) {
      return { kind: "conflict" as const, serverVersion: existing.version };
    }

    const nextVersion = (existing?.version ?? 0) + 1;
    const saved = await tx.orderDraft.upsert({
      where: { userId_storeId: { userId: input.userId, storeId: input.storeId } },
      create: {
        userId: input.userId,
        storeId: input.storeId,
        lines: serializeLines(input.lines),
        note: input.note,
        version: nextVersion,
      },
      update: {
        lines: serializeLines(input.lines),
        note: input.note,
        version: nextVersion,
      },
      select: { version: true, updatedAt: true },
    });

    return {
      kind: "saved" as const,
      version: saved.version,
      savedAt: saved.updatedAt.toISOString(),
    };
  });
}

/** Called when the order is submitted, and when the user clears the basket. */
export async function deleteDraft(userId: string, storeId: string): Promise<void> {
  await prisma.orderDraft
    .delete({ where: { userId_storeId: { userId, storeId } } })
    .catch(() => undefined);
}
