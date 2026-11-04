import Link from "next/link";
import { notFound } from "next/navigation";
import IssueTimeline from "@/components/IssueTimeline";
import { commentIssueAction } from "@/lib/issue-actions";
import { formatDateTime } from "@/lib/format";
import {
  ISSUE_CATEGORY_LABELS,
  ISSUE_STATUS_LABELS,
  MAX_COMMENT_LENGTH,
} from "@/lib/issues";
import { NO_PERSONAL_DATA_SHORT } from "@/lib/privacy";
import { getIssue } from "@/lib/repositories/issues";
import { canActOnStore, canManageIssues } from "@/lib/roles";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Problemrapport — Pouch Club",
};

/**
 * Following a report.
 *
 * The store that filed it can read it and comment; status and assignment are
 * the admin queue's job. An id for another store's report is a 404, not a
 * redirect — there is nothing for this account at that URL.
 */
export default async function StoreIssuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/store/issues/${id}`);

  const issue = await getIssue(id);
  if (!issue) notFound();

  const ownStoreIds = user.stores.map((store) => store.id);
  if (!canActOnStore(user.role, ownStoreIds, issue.storeId) && !canManageIssues(user.role)) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-20 pt-6">
      <p className="text-sm">
        <Link href="/store/issues" className="underline underline-offset-4">
          Alla rapporter
        </Link>
      </p>

      <h1 className="mt-2 text-xl font-semibold tracking-tight">
        {ISSUE_CATEGORY_LABELS[issue.category]}
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        {issue.storeName} · {formatDateTime(issue.createdAt)} · status{" "}
        <strong className="text-zinc-800">{ISSUE_STATUS_LABELS[issue.status]}</strong>
        {issue.assigneeName ? ` · tilldelad ${issue.assigneeName}` : ""}
      </p>

      <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
        <p className="whitespace-pre-wrap text-[17px] leading-relaxed text-zinc-800">
          {issue.text}
        </p>
        {issue.productLabel ? (
          <p className="mt-2 text-sm text-zinc-500">{issue.productLabel}</p>
        ) : null}
        <p className="mt-2 text-xs text-zinc-500">
          Rapporterad av {issue.reporterName ?? "okänd"}
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold tracking-tight">Historik</h2>
        <IssueTimeline events={issue.events} />
      </section>

      <form action={commentIssueAction} className="mt-6">
        <input type="hidden" name="issueId" value={issue.id} />
        <label htmlFor="comment" className="block text-sm font-medium text-zinc-700">
          Lägg till en kommentar
        </label>
        <textarea
          id="comment"
          name="text"
          rows={3}
          maxLength={MAX_COMMENT_LENGTH}
          className="mt-1 w-full rounded-2xl border border-zinc-200 px-4 py-3 text-base outline-none transition focus:border-zinc-400"
        />
        <p className="mt-1 text-sm text-zinc-500">{NO_PERSONAL_DATA_SHORT}</p>
        <button
          type="submit"
          className="mt-3 h-12 w-full rounded-2xl bg-zinc-900 px-6 font-semibold text-white transition active:scale-[0.99]"
        >
          Kommentera
        </button>
      </form>
    </main>
  );
}
