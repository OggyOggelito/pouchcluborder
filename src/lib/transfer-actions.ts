"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { toTransferUnit, type TransferStatus } from "@/lib/transfers";
import {
  TransferConflictError,
  TransferTransitionError,
  accepterIdsFor,
  acceptTransfer,
  createTransfer,
  getTransfer,
  moveTransfer,
} from "@/lib/repositories/transfers";
import { notifyUsers, userIdsForStores } from "@/lib/repositories/notifications";
import { canActOnStore, canPlaceOrders } from "@/lib/roles";
import { requireUser } from "@/lib/session";
import type { UserRecord } from "@/lib/repositories/users";

function ownStoreIds(user: UserRecord): string[] {
  return user.stores.map((store) => store.id);
}

/** Creating and moving transfers is for OWNER and ADMIN; STAFF may only look. */
function assertCanManage(user: UserRecord) {
  if (!canPlaceOrders(user.role)) {
    throw new Error("Din roll kan inte skapa eller ändra överföringar.");
  }
}

export type TransferFormState = { error: string | null };

export async function createTransferAction(
  _state: TransferFormState,
  formData: FormData
): Promise<TransferFormState> {
  const user = await requireUser("/transfers");
  assertCanManage(user);

  const requestingStoreId = String(formData.get("requestingStoreId") ?? "");
  if (!canActOnStore(user.role, ownStoreIds(user), requestingStoreId)) {
    return { error: "Du har inte tillgång till den butiken." };
  }

  const targetStoreId = String(formData.get("targetStoreId") ?? "") || null;

  // productId[] / quantity[] / unit[] arrive as parallel arrays.
  const productIds = formData.getAll("productId").map(String);
  const quantities = formData.getAll("quantity").map((value) => Number(value));
  const units = formData.getAll("unit").map(String);

  const lines = productIds
    .map((productId, index) => ({
      productId,
      quantity: Math.trunc(quantities[index] ?? 0),
      unit: toTransferUnit(units[index]),
    }))
    .filter((line) => line.productId && line.quantity > 0);

  if (lines.length === 0) return { error: "Lägg till minst en produkt med antal." };

  let transferId: string;
  try {
    transferId = await createTransfer({
      requestingStoreId,
      targetStoreId,
      createdById: user.id,
      note: String(formData.get("note") ?? "").trim() || null,
      lines,
    });
  } catch {
    return { error: "Kunde inte skapa förfrågan." };
  }

  // Tell whoever could answer it.
  const recipients = await userIdsForStores(await accepterIdsFor(transferId));
  const store = await prisma.store.findUnique({
    where: { id: requestingStoreId },
    select: { name: true },
  });
  await notifyUsers({
    userIds: recipients,
    type: "TRANSFER_REQUESTED",
    title: `${store?.name ?? "En butik"} söker varor`,
    body: `${lines.length} rad(er). En förfrågan reserverar ingenting.`,
    linkUrl: `/transfers/${transferId}`,
  });

  revalidatePath("/transfers");
  redirect(`/transfers/${transferId}`);
}

export async function acceptTransferAction(formData: FormData) {
  const user = await requireUser("/transfers");
  assertCanManage(user);

  const transferId = String(formData.get("transferId") ?? "");
  const acceptingStoreId = String(formData.get("acceptingStoreId") ?? "");

  if (!canActOnStore(user.role, ownStoreIds(user), acceptingStoreId)) {
    throw new Error("Du har inte tillgång till den butiken.");
  }

  // Region rules decide who may answer at all.
  const eligible = await accepterIdsFor(transferId);
  if (!eligible.includes(acceptingStoreId)) {
    throw new Error("Den butiken kan inte svara på den här förfrågan.");
  }

  try {
    await acceptTransfer({ transferId, acceptingStoreId, userId: user.id });
  } catch (error) {
    if (error instanceof TransferConflictError) {
      // Lost the race — surfaced on the page as "Redan tagen av …".
      revalidatePath(`/transfers/${transferId}`);
      redirect(`/transfers/${transferId}?taken=${encodeURIComponent(error.acceptedByStoreName)}`);
    }
    throw error;
  }

  const transfer = await getTransfer(transferId);
  await notifyUsers({
    userIds: await userIdsForStores([transfer!.requestingStore.id]),
    type: "TRANSFER_ACCEPTED",
    title: `${transfer!.acceptingStore?.name} tar din förfrågan`,
    linkUrl: `/transfers/${transferId}`,
  });

  revalidatePath("/transfers");
  redirect(`/transfers/${transferId}`);
}

/** DECLINED, CANCELLED, SENT and RECEIVED all go through here. */
export async function moveTransferAction(formData: FormData) {
  const user = await requireUser("/transfers");
  assertCanManage(user);

  const transferId = String(formData.get("transferId") ?? "");
  const to = String(formData.get("to") ?? "") as TransferStatus;

  const transfer = await getTransfer(transferId);
  if (!transfer) throw new Error("Okänd överföring.");

  // Only the two stores involved may move it; an admin may always.
  const involved = [
    transfer.requestingStore.id,
    transfer.targetStore?.id,
    transfer.acceptingStore?.id,
  ].filter(Boolean) as string[];

  const mayAct =
    user.role === "ADMIN" || involved.some((storeId) => ownStoreIds(user).includes(storeId));
  if (!mayAct) throw new Error("Du är inte part i den här överföringen.");

  try {
    await moveTransfer({ transferId, to, userId: user.id });
  } catch (error) {
    if (error instanceof TransferTransitionError) {
      redirect(`/transfers/${transferId}?stale=1`);
    }
    throw error;
  }

  const audience =
    to === "RECEIVED"
      ? [transfer.acceptingStore?.id]
      : [transfer.requestingStore.id];

  await notifyUsers({
    userIds: await userIdsForStores(audience.filter(Boolean) as string[]),
    type: `TRANSFER_${to}`,
    title: `Överföring ${to === "SENT" ? "skickad" : to === "RECEIVED" ? "mottagen" : to === "DECLINED" ? "nekad" : "avbruten"}`,
    linkUrl: `/transfers/${transferId}`,
  });

  revalidatePath("/transfers");
  redirect(`/transfers/${transferId}`);
}
