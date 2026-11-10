"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { linkStores, unlinkStores } from "@/lib/repositories/nearby";
import { canManageNearbyStores } from "@/lib/roles";
import { requireUser } from "@/lib/session";

/**
 * Which stores may see each other's free staff.
 *
 * ADMIN only. This is the setting that decides who sees whose employees, so it
 * is not a store's own call — and nothing here infers anything from a map.
 */
async function authorize(): Promise<void> {
  const user = await requireUser("/admin/nearby");
  if (!canManageNearbyStores(user.role)) {
    throw new Error("Bara administratörer kan ändra närliggande butiker.");
  }
}

export async function linkStoresAction(formData: FormData): Promise<void> {
  await authorize();

  const a = String(formData.get("storeId") ?? "");
  const b = String(formData.get("nearbyStoreId") ?? "");
  if (!a || !b || a === b) redirect("/admin/nearby?fel=val");

  await linkStores(a, b);

  revalidatePath("/admin/nearby");
  revalidatePath("/schedule/available");
  redirect("/admin/nearby?sparat=1");
}

export async function unlinkStoresAction(formData: FormData): Promise<void> {
  await authorize();

  await unlinkStores(
    String(formData.get("storeId") ?? ""),
    String(formData.get("nearbyStoreId") ?? "")
  );

  revalidatePath("/admin/nearby");
  revalidatePath("/schedule/available");
  redirect("/admin/nearby?borttagen=1");
}
