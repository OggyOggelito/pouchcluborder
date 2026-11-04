"use server";

import { deleteDraft, saveDraft } from "@/lib/repositories/order-drafts";
import type { DraftLines, DraftSaveResult } from "@/lib/order-drafts";
import { canActOnStore } from "@/lib/roles";
import { requireOrderingUser } from "@/lib/session";

/**
 * Autosave for the order form.
 *
 * The store comes from the form but is checked against the account, like
 * everywhere else — a draft is as much "this person's work" as an order is.
 *
 * Returns a conflict rather than throwing when the same draft moved on
 * elsewhere, so the client can warn instead of losing someone's basket.
 */
export async function saveDraftAction(input: {
  storeId: string;
  lines: DraftLines;
  note: string;
  clientVersion: number;
}): Promise<DraftSaveResult | { kind: "denied" }> {
  const user = await requireOrderingUser("/order");

  const ownStoreIds = user.stores.map((store) => store.id);
  if (!canActOnStore(user.role, ownStoreIds, input.storeId)) {
    return { kind: "denied" };
  }

  return saveDraft({
    userId: user.id,
    storeId: input.storeId,
    lines: input.lines,
    note: input.note.trim() || null,
    clientVersion: input.clientVersion,
  });
}

/** Emptying the basket, or discarding a draft that conflicted. */
export async function clearDraftAction(storeId: string): Promise<void> {
  const user = await requireOrderingUser("/order");

  const ownStoreIds = user.stores.map((store) => store.id);
  if (!canActOnStore(user.role, ownStoreIds, storeId)) return;

  await deleteDraft(user.id, storeId);
}
