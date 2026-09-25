"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createAnnouncement,
  deleteAnnouncement,
  updateAnnouncement,
} from "@/lib/repositories/announcements";
import { toCategory } from "@/lib/announcements";
import { requireAdmin } from "@/lib/session";

export type AnnouncementFormState = { error: string | null; message: string | null };

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function revalidateFeeds() {
  revalidatePath("/news");
  revalidatePath("/staff");
  revalidatePath("/admin/announcements");
}

export async function saveAnnouncementAction(
  _state: AnnouncementFormState,
  formData: FormData
): Promise<AnnouncementFormState> {
  const admin = await requireAdmin();

  const title = text(formData, "title");
  const body = text(formData, "body");

  if (!title) return { error: "Rubrik krävs.", message: null };
  if (!body) return { error: "Innehåll krävs.", message: null };

  const input = {
    title,
    body,
    category: toCategory(formData.get("category")),
    pinned: formData.get("pinned") === "on",
    publish: formData.get("publish") === "on",
  };

  const id = text(formData, "id");
  if (id) {
    await updateAnnouncement(id, input);
  } else {
    await createAnnouncement({ ...input, authorId: admin.id });
  }

  revalidateFeeds();
  return {
    error: null,
    message: input.publish ? "Sparat och publicerat." : "Sparat som utkast.",
  };
}

export async function deleteAnnouncementAction(formData: FormData) {
  await requireAdmin();

  const id = text(formData, "id");
  if (!id) return;

  await deleteAnnouncement(id);
  revalidateFeeds();
  redirect("/admin/announcements");
}
