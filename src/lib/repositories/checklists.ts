import { prisma } from "@/lib/db";
import {
  isDailyType,
  progressOf,
  safeInternalLink,
  stockholmDateKey,
  toChecklistType,
  type ChecklistType,
  type RunProgress,
} from "@/lib/checklists";

export type TemplateSummary = {
  id: string;
  type: ChecklistType;
  title: string;
  intro: string | null;
  active: boolean;
  itemCount: number;
};

export type RunItemView = {
  id: string;
  title: string;
  description: string | null;
  linkUrl: string | null;
  required: boolean;
  position: number;
  checkedAt: Date | null;
  checkedByName: string | null;
  note: string | null;
};

export type RunView = {
  id: string;
  title: string;
  type: ChecklistType;
  storeName: string | null;
  userName: string | null;
  runDate: string | null;
  items: RunItemView[];
  progress: RunProgress;
};

export async function listTemplates(): Promise<TemplateSummary[]> {
  const templates = await prisma.checklistTemplate.findMany({
    orderBy: [{ type: "asc" }, { title: "asc" }],
    select: {
      id: true,
      type: true,
      title: true,
      intro: true,
      active: true,
      _count: { select: { items: true } },
    },
  });
  return templates.map((template) => ({
    id: template.id,
    type: toChecklistType(template.type),
    title: template.title,
    intro: template.intro,
    active: template.active,
    itemCount: template._count.items,
  }));
}

export async function getTemplate(id: string) {
  return prisma.checklistTemplate.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      title: true,
      intro: true,
      active: true,
      items: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          linkUrl: true,
          required: true,
          position: true,
        },
      },
    },
  });
}

/**
 * Finds today's run for a store, or creates it by copying the template's items.
 *
 * The copy is the point: `ChecklistRunItem` holds its own title, description,
 * link and required flag, so editing or reordering the template afterwards
 * never rewrites a list someone has already started working through.
 */
export async function getOrCreateRun(input: {
  templateId: string;
  storeId?: string | null;
  userId?: string | null;
  /** Defaults to today in Europe/Stockholm for the daily types. */
  now?: Date;
}): Promise<string> {
  const template = await prisma.checklistTemplate.findUnique({
    where: { id: input.templateId },
    select: {
      id: true,
      type: true,
      title: true,
      items: {
        orderBy: { position: "asc" },
        select: {
          title: true,
          description: true,
          linkUrl: true,
          required: true,
          position: true,
        },
      },
    },
  });
  if (!template) throw new Error("Unknown checklist template.");

  const type = toChecklistType(template.type);
  const runDate = isDailyType(type) ? stockholmDateKey(input.now) : null;
  const storeId = input.storeId ?? null;
  const userId = input.userId ?? null;

  const existing = await prisma.checklistRun.findFirst({
    where: { templateId: template.id, storeId, userId, runDate },
    select: { id: true },
  });
  if (existing) return existing.id;

  const run = await prisma.checklistRun.create({
    data: {
      templateId: template.id,
      storeId,
      userId,
      runDate,
      // Copied, so renaming the template later does not retitle history.
      title: template.title,
      items: {
        create: template.items.map((item) => ({
          title: item.title,
          description: item.description,
          linkUrl: safeInternalLink(item.linkUrl),
          required: item.required,
          position: item.position,
        })),
      },
    },
    select: { id: true },
  });

  return run.id;
}

export async function getRun(runId: string): Promise<RunView | null> {
  const run = await prisma.checklistRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      title: true,
      runDate: true,
      template: { select: { type: true } },
      store: { select: { name: true } },
      user: { select: { name: true, email: true } },
      items: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          linkUrl: true,
          required: true,
          position: true,
          checkedAt: true,
          note: true,
          checkedBy: { select: { name: true, email: true } },
        },
      },
    },
  });
  if (!run) return null;

  const items: RunItemView[] = run.items.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    linkUrl: item.linkUrl,
    required: item.required,
    position: item.position,
    checkedAt: item.checkedAt,
    checkedByName: item.checkedBy?.name ?? item.checkedBy?.email ?? null,
    note: item.note,
  }));

  return {
    id: run.id,
    title: run.title,
    type: toChecklistType(run.template.type),
    storeName: run.store?.name ?? null,
    userName: run.user?.name ?? run.user?.email ?? null,
    runDate: run.runDate,
    items,
    progress: progressOf(items),
  };
}

/** Which store (if any) a run belongs to — used for the permission check. */
export async function getRunScope(runId: string) {
  return prisma.checklistRun.findUnique({
    where: { id: runId },
    select: { id: true, storeId: true, userId: true, template: { select: { type: true } } },
  });
}

export async function setItemChecked(input: {
  itemId: string;
  checked: boolean;
  userId: string;
}): Promise<void> {
  await prisma.checklistRunItem.update({
    where: { id: input.itemId },
    data: input.checked
      ? { checkedAt: new Date(), checkedById: input.userId }
      : { checkedAt: null, checkedById: null },
  });
}

export async function setItemNote(itemId: string, note: string | null): Promise<void> {
  await prisma.checklistRunItem.update({
    where: { id: itemId },
    data: { note: note && note.trim() ? note.trim() : null },
  });
}

/** Who ticked an item — unticking is restricted to that person or an admin. */
export async function getItemOwner(itemId: string) {
  return prisma.checklistRunItem.findUnique({
    where: { id: itemId },
    select: { id: true, checkedById: true, runId: true },
  });
}

export async function listActiveTemplatesByType(type: ChecklistType) {
  return prisma.checklistTemplate.findMany({
    where: { type, active: true },
    orderBy: { title: "asc" },
    select: { id: true, title: true, intro: true },
  });
}

/** Onboarding runs for one person. */
export async function listOnboardingRunsForUser(userId: string) {
  const runs = await prisma.checklistRun.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      items: { select: { checkedAt: true, required: true } },
    },
  });
  return runs.map((run) => ({
    id: run.id,
    title: run.title,
    progress: progressOf(run.items),
  }));
}
