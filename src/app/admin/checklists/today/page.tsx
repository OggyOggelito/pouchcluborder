import Link from "next/link";
import { prisma } from "@/lib/db";
import { CHECKLIST_TYPE_LABELS, progressOf, stockholmDateKey } from "@/lib/checklists";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Today's opening and closing progress per store, plus onboarding per person.
 *
 * Shows only runs that exist: a store nobody has opened the list for today has
 * no run, which is itself the useful signal.
 */
export default async function ChecklistsTodayPage() {
  await requireAdmin();
  const today = stockholmDateKey();

  const [stores, dailyRuns, onboardingRuns] = await Promise.all([
    prisma.store.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.checklistRun.findMany({
      where: { runDate: today },
      select: {
        id: true,
        storeId: true,
        title: true,
        template: { select: { type: true } },
        items: { select: { checkedAt: true, required: true } },
      },
    }),
    prisma.checklistRun.findMany({
      where: { userId: { not: null } },
      select: {
        id: true,
        title: true,
        user: { select: { name: true, email: true } },
        items: { select: { checkedAt: true, required: true } },
      },
    }),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-6">
      <h1 className="text-xl font-semibold tracking-tight">Dagens status</h1>
      <p className="mt-1 text-muted">{today} · Europe/Stockholm</p>
      <p className="mt-1 text-sm">
        <Link href="/admin/checklists" className="underline underline-offset-4">
          Till mallarna
        </Link>
      </p>

      <h2 className="mt-6 text-lg font-semibold tracking-tight">Butiker</h2>
      <ul className="mt-3 space-y-2">
        {stores.map((store) => {
          const runs = dailyRuns.filter((run) => run.storeId === store.id);
          return (
            <li key={store.id} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
              <p className="font-medium">{store.name}</p>
              {runs.length === 0 ? (
                <p className="mt-1 text-sm text-muted">
                  Ingen lista öppnad i dag.
                </p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {runs.map((run) => {
                    const progress = progressOf(run.items);
                    const label =
                      CHECKLIST_TYPE_LABELS[
                        run.template.type as keyof typeof CHECKLIST_TYPE_LABELS
                      ] ?? run.template.type;
                    const done = progress.total > 0 && progress.done === progress.total;
                    return (
                      <li key={run.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-muted">{label}</span>
                        <span
                          className={`tabular-nums ${done ? "font-medium text-primary" : "text-muted"}`}
                        >
                          {progress.done}/{progress.total}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <h2 className="mt-8 text-lg font-semibold tracking-tight">Introduktioner</h2>
      {onboardingRuns.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-control p-6 text-center text-muted">
          Inga introduktioner tilldelade.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {onboardingRuns.map((run) => {
            const progress = progressOf(run.items);
            return (
              <li
                key={run.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-sm"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {run.user?.name ?? run.user?.email}
                  </span>
                  <span className="block truncate text-sm text-muted">{run.title}</span>
                </span>
                <span className="shrink-0 text-sm tabular-nums text-muted">
                  {progress.done}/{progress.total}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
