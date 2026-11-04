import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import { ISSUE_CATEGORY_LABELS, ISSUE_STATUS_LABELS } from "@/lib/issues";
import type { IssueSummary } from "@/lib/repositories/issues";

const STATUS_BADGE: Record<string, string> = {
  NEW: "bg-amber-100 text-amber-900",
  IN_PROGRESS: "bg-blue-100 text-blue-900",
  RESOLVED: "bg-zinc-100 text-zinc-600",
};

/** One row in a report list. `href` differs between the store and admin views. */
export default function IssueCard({ issue, href }: { issue: IssueSummary; href: string }) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition active:scale-[0.99] hover:border-zinc-300"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            STATUS_BADGE[issue.status] ?? STATUS_BADGE.NEW
          }`}
        >
          {ISSUE_STATUS_LABELS[issue.status]}
        </span>
        <span className="text-xs font-medium text-zinc-500">
          {ISSUE_CATEGORY_LABELS[issue.category]}
        </span>
        <span className="text-xs text-zinc-500">{issue.storeName}</span>
      </div>

      <p className="mt-2 line-clamp-2 text-[15px] text-zinc-800">{issue.text}</p>

      {issue.productLabel ? (
        <p className="mt-1 truncate text-sm text-zinc-500">{issue.productLabel}</p>
      ) : null}

      <p className="mt-2 text-xs text-zinc-500">
        {issue.reporterName ?? "Okänd"} · {formatDateTime(issue.createdAt)}
        {issue.assigneeName ? ` · tilldelad ${issue.assigneeName}` : ""}
      </p>
    </Link>
  );
}
