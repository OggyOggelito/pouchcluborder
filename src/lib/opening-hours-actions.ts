"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  deleteException,
  saveException,
  saveWeekday,
} from "@/lib/repositories/opening-hours";
import { canActOnStore, canEditOpeningHours } from "@/lib/roles";
import { requireUser } from "@/lib/session";
import type { UserRecord } from "@/lib/repositories/users";

/**
 * Opening hours and the days that do not follow them.
 *
 * ADMIN may edit any store; an OWNER only their own. The page lives under
 * /admin because that is where the brief puts it, but it is one of two pages
 * there that is not ADMIN-only — so it cannot use `requireAdmin`, and the
 * per-store check below is the whole protection.
 */
async function authorize(storeId: string): Promise<UserRecord> {
  const user = await requireUser(`/admin/stores/${storeId}/hours`);
  if (!canEditOpeningHours(user.role)) throw new Error("Din roll kan inte ändra öppettider.");
  if (!canActOnStore(user.role, user.stores.map((store) => store.id), storeId)) {
    throw new Error("Du har inte tillgång till den butiken.");
  }
  return user;
}

export async function saveWeekdayAction(formData: FormData): Promise<void> {
  const storeId = String(formData.get("storeId") ?? "");
  await authorize(storeId);

  const weekday = Number(formData.get("weekday"));
  const closed = formData.get("closed") === "on";

  await saveWeekday({
    storeId,
    weekday,
    opensAt: String(formData.get("opensAt") ?? ""),
    closesAt: String(formData.get("closesAt") ?? ""),
    closed,
  });

  revalidatePath(`/admin/stores/${storeId}/hours`);
  revalidatePath("/store/schedule");
  redirect(`/admin/stores/${storeId}/hours?sparat=veckodag`);
}

export async function saveExceptionAction(formData: FormData): Promise<void> {
  const storeId = String(formData.get("storeId") ?? "");
  await authorize(storeId);

  const closed = formData.get("closed") === "on";

  await saveException({
    storeId,
    date: String(formData.get("date") ?? ""),
    closed,
    opensAt: closed ? null : String(formData.get("opensAt") ?? ""),
    closesAt: closed ? null : String(formData.get("closesAt") ?? ""),
    note: String(formData.get("note") ?? "") || null,
  });

  revalidatePath(`/admin/stores/${storeId}/hours`);
  revalidatePath("/store/schedule");
  redirect(`/admin/stores/${storeId}/hours?sparat=avvikelse`);
}

export async function deleteExceptionAction(formData: FormData): Promise<void> {
  const storeId = String(formData.get("storeId") ?? "");
  await authorize(storeId);

  await deleteException(storeId, String(formData.get("id") ?? ""));

  revalidatePath(`/admin/stores/${storeId}/hours`);
  revalidatePath("/store/schedule");
  redirect(`/admin/stores/${storeId}/hours?borttagen=1`);
}
