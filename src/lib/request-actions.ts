"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { toRequestKind, toRequestStatus } from "@/lib/customer-requests";
import {
  findSimilar,
  incrementRequest,
  logRequest,
  setRequestStatus,
} from "@/lib/repositories/customer-requests";
import { canActOnStore } from "@/lib/roles";
import { requireAdmin, requireUser } from "@/lib/session";

export type LogRequestState = {
  error: string | null;
  /** Set after a successful log — staff see only this, never the ranking. */
  confirmation: string | null;
};

/**
 * Logs a customer request.
 *
 * The store comes from the account, never the form — a staff member can only
 * log for a store they work in.
 */
export async function logRequestAction(
  _state: LogRequestState,
  formData: FormData
): Promise<LogRequestState> {
  const user = await requireUser("/requests/new");

  const storeId = String(formData.get("storeId") ?? "");
  if (!storeId || !canActOnStore(user.role, user.stores.map((store) => store.id), storeId)) {
    return { error: "Du har inte tillgång till den butiken.", confirmation: null };
  }

  const brandText = String(formData.get("brandText") ?? "");
  const flavorText = String(formData.get("flavorText") ?? "");
  const productId = String(formData.get("productId") ?? "") || null;

  if (!brandText.trim() && !flavorText.trim() && !productId) {
    return { error: "Skriv vad kunden frågade efter.", confirmation: null };
  }

  try {
    const result = await logRequest({
      storeId,
      recordedById: user.id,
      kind: toRequestKind(formData.get("kind")),
      brandText,
      flavorText,
      productId,
    });

    revalidatePath("/admin/requests");
    return {
      error: null,
      confirmation: result.deduped
        ? `Tack! Räknaren står nu på ${result.count} för den här önskan.`
        : "Tack! Önskemålet är loggat.",
    };
  } catch {
    return { error: "Kunde inte spara önskemålet.", confirmation: null };
  }
}

/** "+1 till" on an existing entry. */
export async function incrementRequestAction(
  _state: LogRequestState,
  formData: FormData
): Promise<LogRequestState> {
  const user = await requireUser("/requests/new");

  const id = String(formData.get("requestId") ?? "");
  if (!id) return { error: "Okänt önskemål.", confirmation: null };

  const request = await prisma.customerRequest.findUnique({
    where: { id },
    select: { storeId: true },
  });
  if (
    !request ||
    !canActOnStore(user.role, user.stores.map((store) => store.id), request.storeId)
  ) {
    return { error: "Du har inte tillgång till den butiken.", confirmation: null };
  }

  await incrementRequest(id);
  revalidatePath("/admin/requests");
  return { error: null, confirmation: "Tack! Räknaren är uppdaterad." };
}

/** Live "similar requests" lookup while typing. */
export async function findSimilarAction(input: {
  storeId: string;
  brandText: string;
  flavorText: string;
}) {
  const user = await requireUser("/requests/new");
  if (!canActOnStore(user.role, user.stores.map((store) => store.id), input.storeId)) {
    return [];
  }

  const rows = await findSimilar({
    storeId: input.storeId,
    brandText: input.brandText,
    flavorText: input.flavorText,
    productId: null,
  });

  return rows.map((row) => ({ ...row, lastSeenAt: row.lastSeenAt.toISOString() }));
}

export async function setRequestStatusAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await setRequestStatus({
    id,
    status: toRequestStatus(formData.get("status")),
    note: String(formData.get("statusNote") ?? "").trim() || null,
    productId: String(formData.get("productId") ?? "") || null,
  });

  revalidatePath("/admin/requests");
}
