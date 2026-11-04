"use server";

import { revalidatePath } from "next/cache";
import { markAllRead } from "@/lib/repositories/notifications";
import { requireUser } from "@/lib/session";

export async function markNotificationsReadAction() {
  const user = await requireUser("/notifications");
  await markAllRead(user.id);
  revalidatePath("/notifications");
}
