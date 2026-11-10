import Link from "next/link";
import ChecklistRunView from "@/components/ChecklistRunView";
import { CHECKLIST_TYPE_LABELS, stockholmDateKey, type ChecklistType } from "@/lib/checklists";
import {
  getOrCreateRun,
  getRun,
  listActiveTemplatesByType,
} from "@/lib/repositories/checklists";
import { canAccessAllStores } from "@/lib/roles";
import { listStores } from "@/lib/repositories/stores";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const DAILY: ChecklistType[] = ["DAILY_OPEN", "DAILY_CLOSE"];

/**
 * Daily and store-opening checklists for the stores this person works in.
 *
 * A run is created the first time someone opens the list that day, which is
 * why this page may write on a GET — the alternative is a cron job that
 * creates empty runs for days nobody worked.
 */
export default async function StaffChecklistsPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string; type?: string }>;
}) {
  const user = await requireUser("/staff/checklists");
  const { store: storeParam, type: typeParam } = await searchParams;

  // Scope comes from the account, never the query string.
  const stores = canAccessAllStores(user.role) ? await listStores() : user.stores;

  if (stores.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-xl font-semibold tracking-tight">Checklistor</h1>
        <p className="mt-2 text-muted">
          Ditt konto är inte kopplat till någon butik. Be en administratör koppla en.
        </p>
      </main>
    );
  }

  const store = stores.find((candidate) => candidate.id === storeParam) ?? stores[0];
  const type: ChecklistType = DAILY.includes(typeParam as ChecklistType)
    ? (typeParam as ChecklistType)
    : "DAILY_OPEN";

  const templates = await listActiveTemplatesByType(type);
  const runs = await Promise.all(
    templates.map(async (template) => {
      const runId = await getOrCreateRun({ templateId: template.id, storeId: store.id });
      return getRun(runId);
    })
  );

  return (
    <main className="mx-auto max-w-2xl px-4 pb-20 pt-6">
      <h1 className="text-xl font-semibold tracking-tight">Checklistor</h1>
      <p className="mt-1 text-muted">
        {store.name} · {stockholmDateKey()}
      </p>

      {stores.length > 1 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {stores.map((candidate) => (
            <Link
              key={candidate.id}
              href={`/staff/checklists?store=${candidate.id}&type=${type}`}
              className={`min-h-tap shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-medium leading-[2.75rem] ${
                candidate.id === store.id
                  ? "border-primary bg-raised font-semibold text-ink ring-1 ring-primary"
                  : "border-control bg-surface text-muted"
              }`}
            >
              {candidate.name}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex gap-2">
        {DAILY.map((candidate) => (
          <Link
            key={candidate}
            href={`/staff/checklists?store=${store.id}&type=${candidate}`}
            className={`min-h-tap flex-1 rounded-full border text-center text-sm font-medium leading-[2.75rem] ${
              candidate === type
                ? "border-primary bg-raised font-semibold text-ink ring-1 ring-primary"
                : "border-control bg-surface text-muted"
            }`}
          >
            {CHECKLIST_TYPE_LABELS[candidate]}
          </Link>
        ))}
      </div>

      {runs.filter(Boolean).length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-control p-6 text-center text-muted">
          Ingen {CHECKLIST_TYPE_LABELS[type].toLowerCase()}slista är upplagd än.
        </p>
      ) : (
        <div className="mt-6 space-y-10">
          {runs.map((run) => (run ? <ChecklistRunView key={run.id} run={run} /> : null))}
        </div>
      )}
    </main>
  );
}
