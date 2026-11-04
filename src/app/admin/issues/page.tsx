import Link from "next/link";
import IssueTimeline from "@/components/IssueTimeline";
import {
  assignIssueAction,
  commentIssueAction,
  setIssueStatusAction,
} from "@/lib/issue-actions";
import { formatDateTime } from "@/lib/format";
import {
  ALLOWED_ISSUE_TRANSITIONS,
  ISSUE_CATEGORIES,
  ISSUE_CATEGORY_LABELS,
  ISSUE_STATUSES,
  ISSUE_STATUS_LABELS,
  MAX_COMMENT_LENGTH,
  isIssueCategory,
  isIssueStatus,
} from "@/lib/issues";
import { NO_PERSONAL_DATA_SHORT } from "@/lib/privacy";
import {
  countOpenIssues,
  getIssue,
  listAdmins,
  listIssuesForAdmin,
} from "@/lib/repositories/issues";
import { listStores } from "@/lib/repositories/stores";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Problemrapporter — Admin",
};

const CHIP = "h-10 shrink-0 rounded-full border px-4 text-sm font-medium leading-[2.5rem]";

/**
 * The queue. ADMIN only, every store.
 *
 * One page rather than a list plus detail route: the work is mostly "read it,
 * change the status, move on", and `?issue=` opens the controls in place so
 * that is two taps instead of a navigation each way.
 */
export default async function AdminIssuesPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    store?: string;
    category?: string;
    issue?: string;
    stale?: string;
  }>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const status = isIssueStatus(params.status) ? params.status : undefined;
  const category = isIssueCategory(params.category) ? params.category : undefined;

  const [stores, admins, open] = await Promise.all([
    listStores(),
    listAdmins(),
    countOpenIssues(),
  ]);

  const storeId = stores.find((store) => store.id === params.store)?.id;
  const issues = await listIssuesForAdmin({ status, storeId, category });
  const selected = params.issue ? await getIssue(params.issue) : null;

  const query = (next: Record<string, string | undefined>) => {
    const merged: Record<string, string> = {};
    for (const [key, value] of Object.entries({
      status,
      store: storeId,
      category,
      ...next,
    })) {
      if (value) merged[key] = value;
    }
    const search = new URLSearchParams(merged).toString();
    return search ? `/admin/issues?${search}` : "/admin/issues";
  };

  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-6">
      <h1 className="text-xl font-semibold tracking-tight">Problemrapporter</h1>
      <p className="mt-1 text-sm text-zinc-500">
        {open === 0
          ? "Inga öppna rapporter."
          : open === 1
            ? "1 öppen rapport."
            : `${open} öppna rapporter.`}{" "}
        Visar {issues.length} med nuvarande filter.
      </p>

      {params.stale ? (
        <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          Rapporten hade redan ändrats — statusen här är den aktuella.
        </p>
      ) : null}

      <div className="mt-4 space-y-2">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <Link
            href={query({ status: undefined })}
            className={`${CHIP} ${
              status ? "border-zinc-200 bg-white text-zinc-600" : "border-zinc-900 bg-zinc-900 text-white"
            }`}
          >
            Alla status
          </Link>
          {ISSUE_STATUSES.map((candidate) => (
            <Link
              key={candidate}
              href={query({ status: candidate })}
              className={`${CHIP} ${
                status === candidate
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-600"
              }`}
            >
              {ISSUE_STATUS_LABELS[candidate]}
            </Link>
          ))}
        </div>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <Link
            href={query({ store: undefined })}
            className={`${CHIP} ${
              storeId ? "border-zinc-200 bg-white text-zinc-600" : "border-zinc-900 bg-zinc-900 text-white"
            }`}
          >
            Alla butiker
          </Link>
          {stores.map((store) => (
            <Link
              key={store.id}
              href={query({ store: store.id })}
              className={`${CHIP} ${
                storeId === store.id
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-600"
              }`}
            >
              {store.name}
            </Link>
          ))}
        </div>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <Link
            href={query({ category: undefined })}
            className={`${CHIP} ${
              category ? "border-zinc-200 bg-white text-zinc-600" : "border-zinc-900 bg-zinc-900 text-white"
            }`}
          >
            Alla typer
          </Link>
          {ISSUE_CATEGORIES.map((candidate) => (
            <Link
              key={candidate}
              href={query({ category: candidate })}
              className={`${CHIP} ${
                category === candidate
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-600"
              }`}
            >
              {ISSUE_CATEGORY_LABELS[candidate]}
            </Link>
          ))}
        </div>
      </div>

      {issues.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-zinc-500">
          Inga rapporter matchar filtret.
        </p>
      ) : (
        <ul className="mt-5 space-y-2">
          {issues.map((issue) => {
            const isOpen = selected?.id === issue.id;
            return (
              <li
                key={issue.id}
                className={`rounded-2xl border bg-white p-4 ${
                  isOpen ? "border-zinc-900" : "border-zinc-200"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      issue.status === "RESOLVED"
                        ? "bg-zinc-100 text-zinc-600"
                        : issue.status === "IN_PROGRESS"
                          ? "bg-blue-100 text-blue-900"
                          : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    {ISSUE_STATUS_LABELS[issue.status]}
                  </span>
                  <span className="text-xs font-medium text-zinc-500">
                    {ISSUE_CATEGORY_LABELS[issue.category]}
                  </span>
                  <span className="text-xs text-zinc-500">{issue.storeName}</span>
                </div>

                <p className="mt-2 whitespace-pre-wrap text-[15px] text-zinc-800">{issue.text}</p>
                {issue.productLabel ? (
                  <p className="mt-1 text-sm text-zinc-500">{issue.productLabel}</p>
                ) : null}
                <p className="mt-2 text-xs text-zinc-500">
                  {issue.reporterName ?? "Okänd"} · {formatDateTime(issue.createdAt)}
                  {issue.assigneeName ? ` · tilldelad ${issue.assigneeName}` : " · inte tilldelad"}
                </p>

                <p className="mt-3 text-sm">
                  <Link
                    href={isOpen ? query({ issue: undefined }) : query({ issue: issue.id })}
                    className="underline underline-offset-4"
                  >
                    {isOpen ? "Stäng" : "Öppna"}
                  </Link>
                </p>

                {isOpen && selected ? (
                  <div className="mt-4 border-t border-zinc-100 pt-4">
                    <div className="flex flex-wrap gap-2">
                      {ALLOWED_ISSUE_TRANSITIONS[selected.status].map((target) => (
                        <form key={target} action={setIssueStatusAction}>
                          <input type="hidden" name="issueId" value={selected.id} />
                          <input type="hidden" name="status" value={target} />
                          <button
                            type="submit"
                            className="h-11 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white"
                          >
                            {target === "RESOLVED"
                              ? "Markera som löst"
                              : target === "IN_PROGRESS" && selected.status === "RESOLVED"
                                ? "Öppna igen"
                                : "Sätt till pågår"}
                          </button>
                        </form>
                      ))}
                    </div>

                    <form action={assignIssueAction} className="mt-4 flex flex-wrap gap-2">
                      <input type="hidden" name="issueId" value={selected.id} />
                      <select
                        name="assigneeId"
                        defaultValue={selected.assigneeId ?? ""}
                        aria-label="Tilldela"
                        className="h-11 min-w-48 flex-1 rounded-xl border border-zinc-200 px-3 text-sm"
                      >
                        <option value="">Ingen tilldelad</option>
                        {admins.map((admin) => (
                          <option key={admin.id} value={admin.id}>
                            {admin.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="h-11 rounded-xl border border-zinc-200 px-4 text-sm font-medium"
                      >
                        Spara tilldelning
                      </button>
                    </form>

                    <h3 className="mt-5 text-sm font-semibold tracking-tight">Historik</h3>
                    <IssueTimeline events={selected.events} />

                    <form action={commentIssueAction} className="mt-4">
                      <input type="hidden" name="issueId" value={selected.id} />
                      <label
                        htmlFor={`comment-${selected.id}`}
                        className="block text-sm font-medium text-zinc-700"
                      >
                        Kommentar till butiken
                      </label>
                      <textarea
                        id={`comment-${selected.id}`}
                        name="text"
                        rows={3}
                        maxLength={MAX_COMMENT_LENGTH}
                        className="mt-1 w-full rounded-2xl border border-zinc-200 px-4 py-3 text-base outline-none transition focus:border-zinc-400"
                      />
                      <p className="mt-1 text-sm text-zinc-500">{NO_PERSONAL_DATA_SHORT}</p>
                      <button
                        type="submit"
                        className="mt-2 h-11 rounded-xl border border-zinc-200 px-4 text-sm font-medium"
                      >
                        Kommentera
                      </button>
                    </form>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
