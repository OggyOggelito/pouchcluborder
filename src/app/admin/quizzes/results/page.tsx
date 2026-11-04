import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import { percentage } from "@/lib/quizzes";
import { listAttemptSummaries } from "@/lib/repositories/quizzes";
import { listStores } from "@/lib/repositories/stores";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Admin-only: everyone's best and latest score, filterable by store. */
export default async function QuizResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string }>;
}) {
  await requireAdmin();
  const { store: storeFilter } = await searchParams;

  // null = every user; only an admin ever reaches this page.
  const [summaries, stores] = await Promise.all([listAttemptSummaries(null), listStores()]);

  const filtered = storeFilter
    ? summaries.filter((row) => row.storeNames.includes(storeFilter))
    : summaries;

  return (
    <main className="mx-auto max-w-4xl px-4 pb-20 pt-6">
      <h1 className="text-xl font-semibold tracking-tight">Quizresultat</h1>
      <p className="mt-1 text-zinc-600">
        {filtered.length} resultat.{" "}
        <Link href="/admin/quizzes" className="underline underline-offset-4">
          Till quizen
        </Link>
      </p>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        <Link
          href="/admin/quizzes/results"
          className={`min-h-tap shrink-0 rounded-full border px-4 text-sm font-medium leading-[2.75rem] ${
            storeFilter ? "border-zinc-200 bg-white text-zinc-600" : "border-zinc-900 bg-zinc-900 text-white"
          }`}
        >
          Alla butiker
        </Link>
        {stores.map((store) => (
          <Link
            key={store.id}
            href={`/admin/quizzes/results?store=${encodeURIComponent(store.name)}`}
            className={`min-h-tap shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-medium leading-[2.75rem] ${
              storeFilter === store.name
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white text-zinc-600"
            }`}
          >
            {store.name}
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-zinc-500">
          Inga försök registrerade{storeFilter ? " för den butiken" : ""} än.
        </p>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left">
                <th className="px-3 py-2 font-semibold">Person</th>
                <th className="px-3 py-2 font-semibold">Quiz</th>
                <th className="px-3 py-2 font-semibold">Bäst</th>
                <th className="px-3 py-2 font-semibold">Senast</th>
                <th className="px-3 py-2 font-semibold">Försök</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={`${row.userId}-${row.quizId}`} className="border-b border-zinc-100 last:border-b-0">
                  <td className="px-3 py-2">
                    <span className="block font-medium">{row.userName}</span>
                    <span className="block text-xs text-zinc-500">{row.storeNames.join(", ") || "—"}</span>
                  </td>
                  <td className="px-3 py-2">{row.quizTitle}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.best ? `${row.best.score}/${row.best.total} (${percentage(row.best.score, row.best.total)} %)` : "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.latest ? (
                      <>
                        {row.latest.score}/{row.latest.total}
                        <span className="block text-xs text-zinc-500">{formatDateTime(row.latest.at)}</span>
                      </>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{row.attempts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
