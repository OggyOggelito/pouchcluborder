"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AlreadyAnsweredError,
  DoubleBookedError,
  ExtraShiftError,
  acceptRequest,
  answerRequest,
  createRequest,
  getRequest,
  recordAcceptedShift,
} from "@/lib/repositories/extra-shifts";
import { notifyUsers, userIdsForStores } from "@/lib/repositories/notifications";
import {
  EXTRA_SHIFT_STATUS_LABELS,
  MAX_EXTRA_SHIFT_NOTE_LENGTH,
} from "@/lib/schedule/extra-shifts";
import { formatDateString, formatRange } from "@/lib/schedule/time";
import { canActOnStore, canEditSchedule, canViewAvailability } from "@/lib/roles";
import { requireUser } from "@/lib/session";
import type { UserRecord } from "@/lib/repositories/users";

/**
 * Extra-shift requests.
 *
 * Two sides, two different permissions, and both derived from the account:
 * the asking store may send and withdraw, the employee's own store may accept
 * or decline. An ADMIN may do either. Nothing here reads a role out of a form.
 */
function ownStoreIds(user: UserRecord): string[] {
  return user.stores.map((store) => store.id);
}

export type ExtraShiftFormState = { error: string | null };

export async function createExtraShiftRequestAction(
  _state: ExtraShiftFormState,
  formData: FormData
): Promise<ExtraShiftFormState> {
  const user = await requireUser("/schedule/available");
  if (!canViewAvailability(user.role)) {
    return { error: "Din roll kan inte skicka förfrågningar om extrapass." };
  }

  const requestingStoreId = String(formData.get("requestingStoreId") ?? "");
  if (!canActOnStore(user.role, ownStoreIds(user), requestingStoreId)) {
    return { error: "Du har inte tillgång till den butiken." };
  }

  const note = String(formData.get("note") ?? "").trim();
  if (note.length > MAX_EXTRA_SHIFT_NOTE_LENGTH) {
    return { error: `Meddelandet får vara högst ${MAX_EXTRA_SHIFT_NOTE_LENGTH} tecken.` };
  }

  let requestId: string;
  try {
    requestId = await createRequest({
      requestingStoreId,
      employeeId: String(formData.get("employeeId") ?? ""),
      date: String(formData.get("date") ?? ""),
      startsAt: String(formData.get("startsAt") ?? ""),
      endsAt: String(formData.get("endsAt") ?? ""),
      note: note || null,
      createdById: user.id,
    });
  } catch (error) {
    if (error instanceof ExtraShiftError) return { error: error.message };
    return { error: "Förfrågan kunde inte skickas." };
  }

  const request = await getRequest(requestId);
  if (request) {
    // The home store decides, so the home store is told.
    await notifyUsers({
      userIds: await userIdsForStores([request.employee.homeStore.id]),
      type: "EXTRA_SHIFT_REQUESTED",
      title: `${request.requestingStore.name} vill låna ${request.employee.name}`,
      body: `${formatDateString(request.date)} ${formatRange(request.startsAt, request.endsAt)}`,
      linkUrl: `/schedule/extra/${requestId}`,
    });
  }

  revalidatePath("/schedule/extra");
  redirect(`/schedule/extra/${requestId}`);
}

export async function acceptExtraShiftAction(formData: FormData): Promise<void> {
  const requestId = String(formData.get("requestId") ?? "");
  const { user, request } = await authorizeHomeStore(requestId);

  try {
    await acceptRequest({
      requestId,
      userId: user.id,
      decidingStoreName: request.employee.homeStore.name,
    });
  } catch (error) {
    if (error instanceof DoubleBookedError) {
      redirect(`/schedule/extra/${requestId}?krock=1`);
    }
    if (error instanceof AlreadyAnsweredError) {
      redirect(`/schedule/extra/${requestId}?svarat=${error.status}`);
    }
    throw error;
  }

  await recordAcceptedShift({ requestId, userId: user.id });

  await notifyUsers({
    userIds: await userIdsForStores([request.requestingStore.id]),
    type: "EXTRA_SHIFT_ACCEPTED",
    title: `${request.employee.name} tar extrapasset`,
    body: `${formatDateString(request.date)} ${formatRange(request.startsAt, request.endsAt)} — passet ligger nu i schemat.`,
    linkUrl: `/schedule/extra/${requestId}`,
  });

  revalidatePath("/schedule/extra");
  revalidatePath("/store/schedule");
  redirect(`/schedule/extra/${requestId}`);
}

export async function declineExtraShiftAction(formData: FormData): Promise<void> {
  const requestId = String(formData.get("requestId") ?? "");
  const { user, request } = await authorizeHomeStore(requestId);

  try {
    await answerRequest({
      requestId,
      to: "DECLINED",
      userId: user.id,
      detail: request.employee.homeStore.name,
    });
  } catch (error) {
    if (error instanceof AlreadyAnsweredError) {
      redirect(`/schedule/extra/${requestId}?svarat=${error.status}`);
    }
    throw error;
  }

  await notifyUsers({
    userIds: await userIdsForStores([request.requestingStore.id]),
    type: "EXTRA_SHIFT_DECLINED",
    title: `Extrapasset ${formatDateString(request.date)} blev nekat`,
    // No reason is asked for and none is passed on. "Nej" is an answer.
    body: `${request.employee.homeStore.name} kan inte avvara ${request.employee.name}.`,
    linkUrl: `/schedule/extra/${requestId}`,
  });

  revalidatePath("/schedule/extra");
  redirect(`/schedule/extra/${requestId}`);
}

/** The asking store withdrawing its own request. */
export async function cancelExtraShiftAction(formData: FormData): Promise<void> {
  const requestId = String(formData.get("requestId") ?? "");
  const user = await requireUser("/schedule/extra");

  const request = await getRequest(requestId);
  if (!request) throw new Error("Okänd förfrågan.");

  if (
    !canViewAvailability(user.role) ||
    !canActOnStore(user.role, ownStoreIds(user), request.requestingStore.id)
  ) {
    throw new Error("Bara den frågande butiken kan återkalla förfrågan.");
  }

  try {
    await answerRequest({ requestId, to: "CANCELLED", userId: user.id });
  } catch (error) {
    if (error instanceof AlreadyAnsweredError) {
      redirect(`/schedule/extra/${requestId}?svarat=${error.status}`);
    }
    throw error;
  }

  await notifyUsers({
    userIds: await userIdsForStores([request.employee.homeStore.id]),
    type: "EXTRA_SHIFT_CANCELLED",
    title: `${request.requestingStore.name} återkallade sin förfrågan`,
    body: `${formatDateString(request.date)} · ${EXTRA_SHIFT_STATUS_LABELS.CANCELLED}`,
    linkUrl: `/schedule/extra/${requestId}`,
  });

  revalidatePath("/schedule/extra");
  redirect(`/schedule/extra/${requestId}`);
}

/**
 * Answering is the home store's call, because it is their staff.
 *
 * An ADMIN may answer too — somebody has to be able to unblock a request when
 * an owner is away, and an admin can already see every store's grid.
 */
async function authorizeHomeStore(requestId: string) {
  const user = await requireUser("/schedule/extra");
  const request = await getRequest(requestId);
  if (!request) throw new Error("Okänd förfrågan.");

  if (
    !canEditSchedule(user.role) ||
    !canActOnStore(user.role, ownStoreIds(user), request.employee.homeStore.id)
  ) {
    throw new Error("Det är medarbetarens egen butik som svarar på förfrågan.");
  }

  return { user, request };
}
