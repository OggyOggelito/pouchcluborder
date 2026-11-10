import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import { ISSUE_CATEGORY_LABELS, ISSUE_STATUS_LABELS } from "@/lib/issues";
import type { IssueSummary } from "@/lib/repositories/issues";

const STATUS_BADGE: Record<string, string> = {
  NEW: "bg-raised text-warning",
  IN_PROGRESS: "bg-raised text-info",
  RESOLVED: "bg-raised text-muted",
};

/** One row in a report list. `href` differs between the store and admin views. */
export default function IssueCard({ issue, href }: { issue: IssueSummary; href: string }) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-line bg-surface p-4 shadow-sm transition active:scale-[0.99] hover:border-control"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            STATUS_BADGE[issue.status] ?? STATUS_BADGE.NEW
          }`}
        >
          {ISSUE_STATUS_LABELS[issue.status]}
        </span>
        <span className="text-xs font-medium text-muted">
          {ISSUE_CATEGORY_LABELS[issue.category]}
        </span>
        <span className="text-xs text-muted">{issue.storeName}</span>
      </div>

      <p className="mt-2 line-clamp-2 text-[15px] text-ink">{issue.text}</p>

      {issue.productLabel ? (
        <p className="mt-1 truncate text-sm text-muted">{issue.productLabel}</p>
      ) : null}

      <p className="mt-2 text-xs text-muted">
        {issue.reporterName ?? "Okänd"} · {formatDateTime(issue.createdAt)}
        {issue.assigneeName ? ` · tilldelad ${issue.assigneeName}` : ""}
      </p>
    </Link>
  );
}
