"use server";

import { revalidatePath } from "next/cache";
import {
  archiveNote,
  createNote,
  deleteNote,
  getNote,
  otherUserIdsForStore,
  setTodoResolved,
  unarchiveNote,
} from "@/lib/repositories/shift-notes";
import { notifyUsers } from "@/lib/repositories/notifications";
import { canActOnStore, canArchiveNotes, canDeleteNotes } from "@/lib/roles";
import { clampNoteText, toNoteCategory } from "@/lib/shift-notes";
import { requireUser } from "@/lib/session";
import type { UserRecord } from "@/lib/repositories/users";

function ownStoreIds(user: UserRecord): string[] {
  return user.stores.map((store) => store.id);
}

/**
 * Whether this user may touch notes belonging to a store.
 *
 * The note's own store is read from the database first — the form only ever
 * supplies an id, never the row it belongs to.
 */
async function assertStoreAccess(user: UserRecord, storeId: string) {
  if (!canActOnStore(user.role, ownStoreIds(user), storeId)) {
    throw new Error("Du har inte tillgång till den butiken.");
  }
}

export type NoteFormState = { error: string | null };

export async function createNoteAction(
  _state: NoteFormState,
  formData: FormData
): Promise<NoteFormState> {
  const user = await requireUser("/store/notes");

  const storeId = String(formData.get("storeId") ?? "");
  if (!canActOnStore(user.role, ownStoreIds(user), storeId)) {
    return { error: "Du har inte tillgång till den butiken." };
  }

  const text = clampNoteText(String(formData.get("text") ?? ""));
  if (!text) return { error: "Skriv vad nästa skift behöver veta." };

  const category = toNoteCategory(formData.get("category"));

  try {
    await createNote({ storeId, authorId: user.id, text, category });
  } catch {
    return { error: "Kunde inte spara anteckningen." };
  }

  // An IMPORTANT note is the only one worth interrupting anyone over.
  if (category === "IMPORTANT") {
    const store = user.stores.find((candidate) => candidate.id === storeId);
    await notifyUsers({
      userIds: await otherUserIdsForStore(storeId, user.id),
      type: "SHIFT_NOTE_IMPORTANT",
      title: `Viktigt i ${store?.name ?? "butiken"}`,
      body: text.slice(0, 140),
      linkUrl: "/store/notes",
    });
  }

  revalidatePath("/store/notes");
  revalidatePath("/staff");
  return { error: null };
}

/** The TODO checkbox. Toggling it records who ticked it and when. */
export async function toggleTodoAction(formData: FormData) {
  const user = await requireUser("/store/notes");

  const note = await getNote(String(formData.get("id") ?? ""));
  if (!note) throw new Error("Okänd anteckning.");
  await assertStoreAccess(user, note.storeId);

  await setTodoResolved({
    id: note.id,
    // The current state comes from the row, not the form, so a stale page
    // cannot flip a note that someone else already ticked.
    resolved: note.resolvedAt === null,
    userId: user.id,
  });

  revalidatePath("/store/notes");
  revalidatePath("/staff");
}

/** OWNER and ADMIN only — this is what takes an IMPORTANT note off the top. */
export async function archiveNoteAction(formData: FormData) {
  const user = await requireUser("/store/notes");
  if (!canArchiveNotes(user.role)) {
    throw new Error("Din roll kan inte arkivera anteckningar.");
  }

  const note = await getNote(String(formData.get("id") ?? ""));
  if (!note) throw new Error("Okänd anteckning.");
  await assertStoreAccess(user, note.storeId);

  const restore = String(formData.get("restore") ?? "") === "1";
  if (restore) {
    await unarchiveNote(note.id);
  } else {
    await archiveNote(note.id);
  }

  revalidatePath("/store/notes");
  revalidatePath("/staff");
}

/** ADMIN only. Archiving is what everyone else gets. */
export async function deleteNoteAction(formData: FormData) {
  const user = await requireUser("/store/notes");
  if (!canDeleteNotes(user.role)) {
    throw new Error("Bara en administratör kan ta bort anteckningar.");
  }

  const note = await getNote(String(formData.get("id") ?? ""));
  if (!note) throw new Error("Okänd anteckning.");

  await deleteNote(note.id);
  revalidatePath("/store/notes");
  revalidatePath("/staff");
}
