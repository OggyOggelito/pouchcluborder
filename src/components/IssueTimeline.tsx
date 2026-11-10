import { formatDateTime } from "@/lib/format";
import { ISSUE_STATUS_LABELS, toIssueStatus } from "@/lib/issues";
import type { IssueDetail } from "@/lib/repositories/issues";

const TYPE_LABELS: Record<string, string> = {
  CREATED: "Rapporten skapades",
  ASSIGNED: "Tilldelad",
  COMMENT: "Kommentar",
  STATUS: "Status",
};

/** Append-only history: status changes, assignments and comments. */
export default function IssueTimeline({ events }: { events: IssueDetail["events"] }) {
  if (events.length === 0) return null;

  return (
    <ol className="mt-3 space-y-3">
      {events.map((event) => (
        <li key={event.id} className="border-l-2 border-line pl-3">
          <p className="text-xs text-muted">
            {TYPE_LABELS[event.type] ?? event.type} · {event.userName ?? "Okänd"} ·{" "}
            {formatDateTime(event.at)}
          </p>
          {event.detail ? (
            <p className="mt-0.5 whitespace-pre-wrap text-[15px] text-ink">
              {event.type === "STATUS"
                ? ISSUE_STATUS_LABELS[toIssueStatus(event.detail)]
                : event.detail}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
