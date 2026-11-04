import { prisma } from "@/lib/db";
import {
  canTransitionIssue,
  clampIssueText,
  toIssueCategory,
  toIssueStatus,
  type IssueCategory,
  type IssueEventType,
  type IssueStatus,
} from "@/lib/issues";

export class IssueTransitionError extends Error {}

export type IssueSummary = {
  id: string;
  storeId: string;
  storeName: string;
  category: IssueCategory;
  status: IssueStatus;
  text: string;
  productLabel: string | null;
  reporterName: string | null;
  assigneeName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type IssueDetail = IssueSummary & {
  assigneeId: string | null;
  events: {
    id: string;
    type: IssueEventType;
    detail: string | null;
    userName: string | null;
    at: Date;
  }[];
};

const ISSUE_SELECT = {
  id: true,
  storeId: true,
  category: true,
  status: true,
  text: true,
  assigneeId: true,
  createdAt: true,
  updatedAt: true,
  store: { select: { name: true } },
  reporter: { select: { name: true, email: true } },
  assignee: { select: { name: true, email: true } },
  product: { select: { brand: true, flavor: true, strength: true, format: true } },
} as const;

type RawIssue = {
  id: string;
  storeId: string;
  category: string;
  status: string;
  text: string;
  assigneeId: string | null;
  createdAt: Date;
  updatedAt: Date;
  store: { name: string };
  reporter: { name: string | null; email: string } | null;
  assignee: { name: string | null; email: string } | null;
  product: { brand: string; flavor: string; strength: string; format: string } | null;
};

function display(person: { name: string | null; email: string } | null): string | null {
  if (!person) return null;
  return person.name?.trim() || person.email;
}

function toSummary(issue: RawIssue): IssueSummary {
  return {
    id: issue.id,
    storeId: issue.storeId,
    storeName: issue.store.name,
    category: toIssueCategory(issue.category),
    status: toIssueStatus(issue.status),
    text: issue.text,
    productLabel: issue.product
      ? `${issue.product.brand} ${issue.product.flavor} ${issue.product.strength} ${issue.product.format}`.trim()
      : null,
    reporterName: display(issue.reporter),
    assigneeName: display(issue.assignee),
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
  };
}

export async function createIssue(input: {
  storeId: string;
  reporterId: string;
  category: IssueCategory;
  productId: string | null;
  text: string;
}): Promise<string> {
  const text = clampIssueText(input.text);
  if (!text) throw new Error("A report needs some text.");

  const issue = await prisma.issueReport.create({
    data: {
      storeId: input.storeId,
      reporterId: input.reporterId,
      category: input.category,
      productId: input.productId,
      text,
      events: { create: { type: "CREATED", userId: input.reporterId } },
    },
    select: { id: true },
  });
  return issue.id;
}

/**
 * One store's reports, newest first.
 *
 * Scoped by the caller's store ids, like the notes feed: an empty list returns
 * nothing rather than everything.
 */
export async function listIssuesForStores(input: {
  storeIds: string[];
  status?: IssueStatus;
  limit?: number;
}): Promise<IssueSummary[]> {
  if (input.storeIds.length === 0) return [];

  const rows = await prisma.issueReport.findMany({
    where: {
      storeId: { in: input.storeIds },
      ...(input.status ? { status: input.status } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    take: input.limit ?? 100,
    select: ISSUE_SELECT,
  });
  return (rows as RawIssue[]).map(toSummary);
}

/** The admin queue. Open reports first, then newest. */
export async function listIssuesForAdmin(filter: {
  status?: IssueStatus;
  storeId?: string;
  category?: IssueCategory;
  limit?: number;
}): Promise<IssueSummary[]> {
  const rows = await prisma.issueReport.findMany({
    where: {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.storeId ? { storeId: filter.storeId } : {}),
      ...(filter.category ? { category: filter.category } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    take: filter.limit ?? 200,
    select: ISSUE_SELECT,
  });

  const summaries = (rows as RawIssue[]).map(toSummary);

  // Unresolved first. Done here rather than as an orderBy because "open" spans
  // two statuses, and SQLite has no ordering expression for that.
  return summaries.sort((a, b) => {
    const openness = Number(a.status === "RESOLVED") - Number(b.status === "RESOLVED");
    if (openness !== 0) return openness;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

export async function countOpenIssues(storeIds?: string[]): Promise<number> {
  if (storeIds && storeIds.length === 0) return 0;
  return prisma.issueReport.count({
    where: {
      status: { in: ["NEW", "IN_PROGRESS"] },
      ...(storeIds ? { storeId: { in: storeIds } } : {}),
    },
  });
}

export async function getIssue(id: string): Promise<IssueDetail | null> {
  if (!id) return null;

  const issue = await prisma.issueReport.findUnique({
    where: { id },
    select: {
      ...ISSUE_SELECT,
      events: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          type: true,
          detail: true,
          createdAt: true,
          user: { select: { name: true, email: true } },
        },
      },
    },
  });
  if (!issue) return null;

  const raw = issue as RawIssue & {
    events: {
      id: string;
      type: string;
      detail: string | null;
      createdAt: Date;
      user: { name: string | null; email: string } | null;
    }[];
  };

  return {
    ...toSummary(raw),
    assigneeId: raw.assigneeId,
    events: raw.events.map((event) => ({
      id: event.id,
      type: event.type as IssueEventType,
      detail: event.detail,
      userName: display(event.user),
      at: event.createdAt,
    })),
  };
}

/** Who to tell when a report changes: the reporter. */
export async function reporterIdFor(issueId: string): Promise<string | null> {
  const issue = await prisma.issueReport.findUnique({
    where: { id: issueId },
    select: { reporterId: true },
  });
  return issue?.reporterId ?? null;
}

/**
 * Moves a report, refusing anything the status flow does not allow.
 *
 * The current status is read inside the transaction and the update is
 * conditional on it, so two admins clicking at once cannot both apply a move
 * from the same starting point.
 */
export async function setIssueStatus(input: {
  issueId: string;
  to: IssueStatus;
  userId: string;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const issue = await tx.issueReport.findUnique({
      where: { id: input.issueId },
      select: { status: true },
    });
    if (!issue) throw new IssueTransitionError("Okänd rapport.");

    const from = toIssueStatus(issue.status);
    if (from === input.to) return;
    if (!canTransitionIssue(from, input.to)) {
      throw new IssueTransitionError(`Kan inte gå från ${from} till ${input.to}.`);
    }

    const updated = await tx.issueReport.updateMany({
      where: { id: input.issueId, status: from },
      data: { status: input.to },
    });
    if (updated.count === 0) throw new IssueTransitionError("Rapporten ändrades av någon annan.");

    await tx.issueEvent.create({
      data: { issueId: input.issueId, type: "STATUS", userId: input.userId, detail: input.to },
    });
  });
}

/** `assigneeId` of null unassigns. The caller checks the assignee is an ADMIN. */
export async function assignIssue(input: {
  issueId: string;
  assigneeId: string | null;
  assigneeName: string | null;
  userId: string;
}): Promise<void> {
  await prisma.$transaction([
    prisma.issueReport.update({
      where: { id: input.issueId },
      data: { assigneeId: input.assigneeId },
    }),
    prisma.issueEvent.create({
      data: {
        issueId: input.issueId,
        type: "ASSIGNED",
        userId: input.userId,
        detail: input.assigneeName,
      },
    }),
  ]);
}

export async function addIssueComment(input: {
  issueId: string;
  userId: string;
  text: string;
}): Promise<void> {
  const text = clampIssueText(input.text);
  if (!text) throw new Error("A comment needs some text.");

  await prisma.issueEvent.create({
    data: { issueId: input.issueId, type: "COMMENT", userId: input.userId, detail: text },
  });
}

/** Every ADMIN — the audience for a new report, and the assignable people. */
export async function listAdmins(): Promise<{ id: string; name: string }[]> {
  const rows = await prisma.user.findMany({
    where: { role: "ADMIN" },
    orderBy: { email: "asc" },
    select: { id: true, name: true, email: true },
  });
  return rows.map((row) => ({ id: row.id, name: row.name?.trim() || row.email }));
}
