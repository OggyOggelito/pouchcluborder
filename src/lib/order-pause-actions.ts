"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createPause, liftPause } from "@/lib/repositories/order-pause";
import { toPauseScope, validatePause } from "@/lib/order-pause";
import { canPauseOrders } from "@/lib/roles";
import { requireUser } from "@/lib/session";

/**
 * Pausing and lifting.
 *
 * ADMIN only. A pause stops every store ordering, so it is not a store's own
 * call — and lifting it is the same power in reverse.
 */
async function authorize() {
  const user = await requireUser("/admin/order-pause");
  if (!canPauseOrders(user.role)) throw new Error("Bara administratörer kan pausa beställningar.");
  return user;
}

export type PauseState = { error: string | null };

/** A local datetime from `<input type="datetime-local">`, or now. */
function toDate(value: FormDataEntryValue | null): Date | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function createPauseAction(
  _state: PauseState,
  formData: FormData
): Promise<PauseState> {
  const user = await authorize();

  const scope = toPauseScope(formData.get("scope"));
  const storeId = String(formData.get("storeId") ?? "") || null;
  const brandId = String(formData.get("brandId") ?? "") || null;
  const startsAt = toDate(formData.get("startsAt")) ?? new Date();
  const endsAt = toDate(formData.get("endsAt"));
  const message = String(formData.get("message") ?? "");

  const check = validatePause({ scope, storeId, brandId, startsAt, endsAt, message });
  if (!check.ok) return { error: check.error };

  await createPause({ scope, storeId, brandId, startsAt, endsAt, message, createdById: user.id });

  revalidatePath("/admin/order-pause");
  revalidatePath("/order");
  revalidatePath("/idag");
  redirect("/admin/order-pause?sparat=1");
}

export async function liftPauseAction(formData: FormData): Promise<void> {
  const user = await authorize();

  await liftPause({ id: String(formData.get("id") ?? ""), userId: user.id });

  revalidatePath("/admin/order-pause");
  revalidatePath("/order");
  revalidatePath("/idag");
  redirect("/admin/order-pause?lyft=1");
}
