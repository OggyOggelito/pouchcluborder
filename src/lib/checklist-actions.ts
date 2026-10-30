"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { safeInternalLink, toChecklistType } from "@/lib/checklists";
import {
  getItemOwner,
  getRunScope,
  setItemChecked,
  setItemNote,
} from "@/lib/repositories/checklists";
import { canAccessAdmin, canActOnStore } from "@/lib/roles";
import { getSessionUser, requireAdmin, requireUser } from "@/lib/session";
import type { UserRecord } from "@/lib/repositories/users";

/**
 * May this user work this run?
 *
 * Store-scoped runs need access to that store; an onboarding run belongs to
 * one person. An ADMIN may work any run. Checked on the server for every
 * mutation — the UI hiding a button is not a permission.
 */
async function assertCanWorkRun(user: UserRecord, runId: string) {
  const scope = await getRunScope(runId);
  if (!scope) throw new Error("Unknown checklist run.");

  if (canAccessAdmin(user.role)) return;

  if (scope.userId) {
    if (scope.userId !== user.id) throw new Error("Not your checklist.");
    return;
  }

  if (scope.storeId) {
    const allowed = canActOnStore(
      user.role,
      user.stores.map((store) => store.id),
      scope.storeId
    );
    if (!allowed) throw new Error("No access to that store's checklist.");
    return;
  }

  throw new Error("Checklist run has no scope.");
}

export async function toggleChecklistItemAction(formData: FormData) {
  const user = await requireUser("/staff/checklists");

  const itemId = String(formData.get("itemId") ?? "");
  const runId = String(formData.get("runId") ?? "");
  const checked = formData.get("checked") === "1";
  if (!itemId || !runId) return;

  await assertCanWorkRun(user, runId);

  // Unticking is allowed for whoever ticked it, or an admin — so one person
  // cannot quietly undo another's work on a shared store list.
  if (!checked) {
    const item = await getItemOwner(itemId);
    const isOwner = item?.checkedById === user.id;
    if (!isOwner && !canAccessAdmin(user.role)) {
      throw new Error("Only the person who ticked this, or an admin, can untick it.");
    }
  }

  await setItemChecked({ itemId, checked, userId: user.id });
  revalidatePath("/staff/checklists");
  revalidatePath("/my-onboarding");
  revalidatePath("/admin/checklists/today");
}

export async function saveChecklistNoteAction(formData: FormData) {
  const user = await requireUser("/staff/checklists");

  const itemId = String(formData.get("itemId") ?? "");
  const runId = String(formData.get("runId") ?? "");
  const note = formData.get("note");
  if (!itemId || !runId) return;

  await assertCanWorkRun(user, runId);
  await setItemNote(itemId, typeof note === "string" ? note : null);

  revalidatePath("/staff/checklists");
  revalidatePath("/my-onboarding");
}

// ---------------------------------------------------------------------------
// Admin: templates
// ---------------------------------------------------------------------------

export async function saveTemplateAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const intro = String(formData.get("intro") ?? "").trim() || null;
  const type = toChecklistType(formData.get("type"));
  const active = formData.get("active") === "on";

  if (!title) return;

  if (id) {
    await prisma.checklistTemplate.update({
      where: { id },
      data: { title, intro, type, active },
    });
  } else {
    const created = await prisma.checklistTemplate.create({
      data: { title, intro, type, active },
      select: { id: true },
    });
    revalidatePath("/admin/checklists");
    redirect(`/admin/checklists/${created.id}`);
  }

  revalidatePath("/admin/checklists");
  revalidatePath(`/admin/checklists/${id}`);
}

export async function saveTemplateItemAction(formData: FormData) {
  await requireAdmin();

  const templateId = String(formData.get("templateId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!templateId || !title) return;

  const data = {
    title,
    description: String(formData.get("description") ?? "").trim() || null,
    linkUrl: safeInternalLink(String(formData.get("linkUrl") ?? "")),
    required: formData.get("required") === "on",
  };

  if (itemId) {
    await prisma.checklistItem.update({ where: { id: itemId }, data });
  } else {
    const last = await prisma.checklistItem.findFirst({
      where: { templateId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    await prisma.checklistItem.create({
      data: { ...data, templateId, position: (last?.position ?? -1) + 1 },
    });
  }

  revalidatePath(`/admin/checklists/${templateId}`);
}

export async function deleteTemplateItemAction(formData: FormData) {
  await requireAdmin();
  const itemId = String(formData.get("itemId") ?? "");
  const templateId = String(formData.get("templateId") ?? "");
  if (!itemId) return;

  await prisma.checklistItem.delete({ where: { id: itemId } });
  revalidatePath(`/admin/checklists/${templateId}`);
}

/** Moves an item one step up or down by swapping positions with its neighbour. */
export async function reorderTemplateItemAction(formData: FormData) {
  await requireAdmin();

  const itemId = String(formData.get("itemId") ?? "");
  const templateId = String(formData.get("templateId") ?? "");
  const direction = formData.get("direction") === "up" ? "up" : "down";
  if (!itemId || !templateId) return;

  const items = await prisma.checklistItem.findMany({
    where: { templateId },
    orderBy: { position: "asc" },
    select: { id: true, position: true },
  });

  const index = items.findIndex((item) => item.id === itemId);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= items.length) return;

  await prisma.$transaction([
    prisma.checklistItem.update({
      where: { id: items[index].id },
      data: { position: items[swapWith].position },
    }),
    prisma.checklistItem.update({
      where: { id: items[swapWith].id },
      data: { position: items[index].position },
    }),
  ]);

  revalidatePath(`/admin/checklists/${templateId}`);
}

/** Assigns an ONBOARDING template to a person, creating their run. */
export async function assignOnboardingAction(formData: FormData) {
  await requireAdmin();

  const templateId = String(formData.get("templateId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  if (!templateId || !userId) return;

  const { getOrCreateRun } = await import("@/lib/repositories/checklists");
  await getOrCreateRun({ templateId, userId });

  revalidatePath("/admin/checklists");
  revalidatePath("/admin/checklists/today");
}

export { getSessionUser };
