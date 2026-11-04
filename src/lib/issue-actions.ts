"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  IssueTransitionError,
  addIssueComment,
  assignIssue,
  createIssue,
  getIssue,
  listAdmins,
  reporterIdFor,
  setIssueStatus,
} from "@/lib/repositories/issues";
import { notifyUsers, userIdsForRole } from "@/lib/repositories/notifications";
import {
  ISSUE_CATEGORY_LABELS,
  ISSUE_STATUS_LABELS,
  MAX_COMMENT_LENGTH,
  clampIssueText,
  toIssueCategory,
  toIssueStatus,
} from "@/lib/issues";
import { canActOnStore, canManageIssues } from "@/lib/roles";
import { requireAdmin, requireUser } from "@/lib/session";
import type { UserRecord } from "@/lib/repositories/users";

function ownStoreIds(user: UserRecord): string[] {
  return user.stores.map((store) => store.id);
}

export type IssueFormState = { error: string | null };

/** Anyone with access to the store may report a problem, STAFF included. */
export async function createIssueAction(
  _state: IssueFormState,
  formData: FormData
): Promise<IssueFormState> {
  const user = await requireUser("/store/issues");

  const storeId = String(formData.get("storeId") ?? "");
  if (!canActOnStore(user.role, ownStoreIds(user), storeId)) {
    return { error: "Du har inte tillgång till den butiken." };
  }

  const text = clampIssueText(String(formData.get("text") ?? ""));
  if (!text) return { error: "Beskriv problemet kort." };

  const category = toIssueCategory(formData.get("category"));
  const productId = String(formData.get("productId") ?? "") || null;

  let issueId: string;
  try {
    issueId = await createIssue({
      storeId,
      reporterId: user.id,
      category,
      productId,
      text,
    });
  } catch {
    return { error: "Kunde inte spara rapporten." };
  }

  // Every admin hears about a new report; nobody is assigned yet. The person
  // who filed it is skipped — an admin reporting a problem in their own store
  // does not need telling about it.
  const store = user.stores.find((candidate) => candidate.id === storeId);
  const admins = (await userIdsForRole("ADMIN")).filter((id) => id !== user.id);
  await notifyUsers({
    userIds: admins,
    type: "ISSUE_CREATED",
    title: `Ny problemrapport: ${ISSUE_CATEGORY_LABELS[category]}`,
    body: `${store?.name ?? "En butik"} — ${text.slice(0, 120)}`,
    linkUrl: `/admin/issues?issue=${issueId}`,
  });

  revalidatePath("/store/issues");
  revalidatePath("/admin/issues");
  redirect(`/store/issues/${issueId}`);
}

/**
 * Comment on a report.
 *
 * Open to both sides: the store that reported it and the admins working it.
 * An admin's comment notifies the reporter, and nothing notifies the admin who
 * wrote it.
 */
export async function commentIssueAction(formData: FormData) {
  const user = await requireUser("/store/issues");

  const issueId = String(formData.get("issueId") ?? "");
  const issue = await getIssue(issueId);
  if (!issue) throw new Error("Okänd rapport.");

  const mayComment =
    canManageIssues(user.role) || canActOnStore(user.role, ownStoreIds(user), issue.storeId);
  if (!mayComment) throw new Error("Du har inte tillgång till den rapporten.");

  const text = clampIssueText(String(formData.get("text") ?? ""), MAX_COMMENT_LENGTH);
  if (!text) return;

  await addIssueComment({ issueId, userId: user.id, text });

  const reporterId = await reporterIdFor(issueId);
  if (reporterId && reporterId !== user.id) {
    await notifyUsers({
      userIds: [reporterId],
      type: "ISSUE_COMMENT",
      title: "Ny kommentar på din problemrapport",
      body: text.slice(0, 140),
      linkUrl: `/store/issues/${issueId}`,
    });
  }

  revalidatePath(`/store/issues/${issueId}`);
  revalidatePath("/admin/issues");
}

/** ADMIN only. The reporter is told whenever the status moves. */
export async function setIssueStatusAction(formData: FormData) {
  const user = await requireAdmin();

  const issueId = String(formData.get("issueId") ?? "");
  const to = toIssueStatus(formData.get("status"));

  try {
    await setIssueStatus({ issueId, to, userId: user.id });
  } catch (error) {
    if (error instanceof IssueTransitionError) {
      // A stale queue page tried an impossible move; reload rather than crash.
      revalidatePath("/admin/issues");
      redirect("/admin/issues?stale=1");
    }
    throw error;
  }

  const reporterId = await reporterIdFor(issueId);
  if (reporterId && reporterId !== user.id) {
    await notifyUsers({
      userIds: [reporterId],
      type: `ISSUE_${to}`,
      title: `Din problemrapport: ${ISSUE_STATUS_LABELS[to]}`,
      linkUrl: `/store/issues/${issueId}`,
    });
  }

  revalidatePath("/admin/issues");
  revalidatePath(`/store/issues/${issueId}`);
}

/** ADMIN only, and only an ADMIN can be the assignee. */
export async function assignIssueAction(formData: FormData) {
  const user = await requireAdmin();

  const issueId = String(formData.get("issueId") ?? "");
  const assigneeId = String(formData.get("assigneeId") ?? "") || null;

  let assigneeName: string | null = null;
  if (assigneeId) {
    const admins = await listAdmins();
    const assignee = admins.find((candidate) => candidate.id === assigneeId);
    if (!assignee) throw new Error("Bara administratörer kan tilldelas rapporter.");
    assigneeName = assignee.name;
  }

  await assignIssue({ issueId, assigneeId, assigneeName, userId: user.id });

  if (assigneeId && assigneeId !== user.id) {
    await notifyUsers({
      userIds: [assigneeId],
      type: "ISSUE_ASSIGNED",
      title: "Du har fått en problemrapport",
      linkUrl: `/admin/issues?issue=${issueId}`,
    });
  }

  revalidatePath("/admin/issues");
  revalidatePath(`/store/issues/${issueId}`);
}
