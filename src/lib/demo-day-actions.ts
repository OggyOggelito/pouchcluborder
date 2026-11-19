"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  BookingConflictError,
  DemoDayError,
  cancelBySupplier,
  createBookings,
  decide,
  getBooking,
  staffForStore,
} from "@/lib/repositories/demo-days";
import { notifyUsers, userIdsForRole } from "@/lib/repositories/notifications";
import { stockholmDateKey } from "@/lib/checklists";
import { canSupplierCancel, checkRequestDate, type DemoStatus } from "@/lib/demo-days";
import { formatDateString } from "@/lib/schedule/time";
import { canActOnStore, canDecideDemoDays } from "@/lib/roles";
import { requireUser } from "@/lib/session";
import { requireSupplier } from "@/lib/supplier-session";

/**
 * Demo-day bookings, from both sides.
 *
 * The supplier actions take their brand from the session and never from the
 * form: a brand id in a POST body is a request, not a permission. The staff
 * actions check the store the same way.
 */
export type BookingState = { error: string | null };

export async function bookDemoDayAction(
  _state: BookingState,
  formData: FormData
): Promise<BookingState> {
  const supplier = await requireSupplier("/supplier/boka");

  const date = String(formData.get("date") ?? "");
  const storeIds = formData.getAll("storeId").map(String).filter(Boolean);
  const note = String(formData.get("note") ?? "");

  const dateCheck = checkRequestDate(date, stockholmDateKey());
  if (!dateCheck.ok) return { error: dateCheck.error };
  if (storeIds.length === 0) return { error: "Välj minst en butik." };

  let groupId: string;
  try {
    const result = await createBookings({
      // From the session. The form has no brand field at all.
      brandId: supplier.brand.id,
      supplierUserId: supplier.id,
      date,
      storeIds,
      note,
    });
    groupId = result.groupId;

    for (const created of result.created) {
      const recipients = await staffForStore(created.storeId);
      await notifyUsers({
        userIds: [...recipients, ...(await userIdsForRole("ADMIN"))],
        type: "DEMO_DAY_REQUESTED",
        title: `${supplier.brand.name} vill ha demodag`,
        body: `${created.storeName} · ${formatDateString(date)}`,
        linkUrl: "/store/demo-days",
      });
    }
  } catch (error) {
    if (error instanceof DemoDayError) return { error: error.message };
    return { error: "Bokningen kunde inte skapas." };
  }

  revalidatePath("/supplier/bokningar");
  redirect(`/supplier/bokningar?grupp=${groupId}`);
}

/** The supplier pulling out, inside the cut-off window. */
export async function cancelDemoDayAction(formData: FormData): Promise<void> {
  const supplier = await requireSupplier("/supplier/bokningar");
  const id = String(formData.get("id") ?? "");

  const booking = await getBooking(id);
  // Scoped by brand twice: here, and again in the repository's write.
  if (!booking || booking.brand.id !== supplier.brand.id) {
    redirect("/supplier/bokningar");
  }

  if (!canSupplierCancel({ status: booking.status, date: booking.date, today: stockholmDateKey() })) {
    redirect("/supplier/bokningar?forsent=1");
  }

  await cancelBySupplier({ id, brandId: supplier.brand.id });

  await notifyUsers({
    userIds: await staffForStore(booking.store.id),
    type: "DEMO_DAY_CANCELLED",
    title: `${booking.brand.name} avbokade demodagen`,
    body: `${booking.store.name} · ${formatDateString(booking.date)}`,
    linkUrl: "/store/demo-days",
  });

  revalidatePath("/supplier/bokningar");
  redirect("/supplier/bokningar?avbokad=1");
}

/**
 * The store answering.
 *
 * An OWNER answers for their own shops, an ADMIN for any. The decision is
 * written to the booking and shown to the supplier in the portal — there is no
 * mail transport in this app, so that is where they will see it.
 */
export async function decideDemoDayAction(formData: FormData): Promise<void> {
  const user = await requireUser("/store/demo-days");

  const id = String(formData.get("id") ?? "");
  const to = String(formData.get("to") ?? "") as DemoStatus;
  const note = String(formData.get("note") ?? "") || null;
  const back = String(formData.get("back") ?? "/store/demo-days");

  const booking = await getBooking(id);
  if (!booking) redirect(back);

  if (
    !canDecideDemoDays(user.role) ||
    !canActOnStore(user.role, user.stores.map((store) => store.id), booking.store.id)
  ) {
    throw new Error("Det är butiken som svarar på demodagen.");
  }
  if (to !== "CONFIRMED" && to !== "DECLINED" && to !== "CANCELLED_BY_STORE") {
    throw new Error("Okänt svar.");
  }

  try {
    await decide({ id, to, userId: user.id, note });
  } catch (error) {
    if (error instanceof BookingConflictError) redirect(`${back}?krock=1`);
    if (error instanceof DemoDayError) redirect(`${back}?svarat=1`);
    throw error;
  }

  revalidatePath("/store/demo-days");
  revalidatePath("/admin/demo-days");
  redirect(`${back}?sparat=1`);
}
