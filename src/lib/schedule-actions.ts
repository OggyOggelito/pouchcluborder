"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ScheduleWriteError,
  applyCopy,
  clearDay,
  deleteShift,
  saveShift,
} from "@/lib/repositories/schedule-week";
import { canActOnStore, canEditSchedule } from "@/lib/roles";
import { requireUser } from "@/lib/session";
import type { UserRecord } from "@/lib/repositories/users";

/**
 * Writing the week grid.
 *
 * Every one of these re-derives the scope from the signed-in account and the
 * store id it was handed. A store id in a form field is a request, not a
 * permission — the check is here, on the server, on every call, exactly as it
 * is for orders and transfers.
 *
 * The grid saves per change rather than behind a "Spara" button, so these
 * return a result the client can show instead of throwing: a failed autosave
 * has to be visible in the cell, not as a crashed page.
 */
export type ScheduleActionResult =
  | { kind: "saved"; id?: string }
  | { kind: "denied" }
  | { kind: "error"; message: string };

async function authorize(storeId: string): Promise<UserRecord | null> {
  const user = await requireUser("/store/schedule");
  if (!canEditSchedule(user.role)) return null;
  if (!canActOnStore(user.role, user.stores.map((store) => store.id), storeId)) return null;
  return user;
}

export async function saveShiftAction(input: {
  id?: string | null;
  storeId: string;
  employeeId: string;
  date: string;
  startsAt: string;
  endsAt: string;
  note: string;
}): Promise<ScheduleActionResult> {
  const user = await authorize(input.storeId);
  if (!user) return { kind: "denied" };

  try {
    const { id } = await saveShift({
      id: input.id ?? null,
      storeId: input.storeId,
      employeeId: input.employeeId,
      date: input.date,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      note: input.note.trim() || null,
      userId: user.id,
    });
    revalidatePath("/store/schedule");
    return { kind: "saved", id };
  } catch (error) {
    if (error instanceof ScheduleWriteError) return { kind: "error", message: error.message };
    return { kind: "error", message: "Passet kunde inte sparas." };
  }
}

export async function deleteShiftAction(input: {
  id: string;
  storeId: string;
}): Promise<ScheduleActionResult> {
  const user = await authorize(input.storeId);
  if (!user) return { kind: "denied" };

  try {
    await deleteShift({ id: input.id, storeId: input.storeId, userId: user.id });
    revalidatePath("/store/schedule");
    return { kind: "saved" };
  } catch {
    return { kind: "error", message: "Passet kunde inte tas bort." };
  }
}

/** "Ledig" — removes that person's shifts at this store on that day. */
export async function clearDayAction(input: {
  storeId: string;
  employeeId: string;
  date: string;
}): Promise<ScheduleActionResult> {
  const user = await authorize(input.storeId);
  if (!user) return { kind: "denied" };

  try {
    await clearDay({ ...input, userId: user.id });
    revalidatePath("/store/schedule");
    return { kind: "saved" };
  } catch {
    return { kind: "error", message: "Dagen kunde inte rensas." };
  }
}

/**
 * Applies a copy the manager has previewed.
 *
 * A form submit rather than a client call: it is the one write here that is
 * big enough to want a page reload and a fresh grid afterwards.
 */
export async function applyCopyAction(formData: FormData): Promise<void> {
  const storeId = String(formData.get("storeId") ?? "");
  const user = await authorize(storeId);
  if (!user) throw new Error("Du har inte tillgång till den butiken.");

  const sourceDate = String(formData.get("sourceDate") ?? "");
  const targetDate = String(formData.get("targetDate") ?? "");
  const scope = String(formData.get("scope") ?? "week") === "day" ? "day" : "week";

  const result = await applyCopy({ storeId, sourceDate, targetDate, scope, userId: user.id });

  revalidatePath("/store/schedule");
  redirect(
    `/store/schedule?store=${storeId}&date=${targetDate}&kopierade=${result.created}&hoppade=${result.skipped}`
  );
}
