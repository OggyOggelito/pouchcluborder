import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import { filterArticles } from "@/lib/knowledge";
import { listCategories, listPublishedArticles } from "@/lib/repositories/knowledge";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Rutiner — Pouch Club",
  description: "Hur vi gör saker i butik.",
};

/**
 * "How do we do this" — separate from the brand pages, which are about
 * products.
 *
 * Signed-in only, and only published articles. Search and the category chips
 * are plain links so the page works without JavaScript on a shop-floor phone.
 */
export default async function RoutinesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  await requireUser("/staff/routines");
  const { q, category } = await searchParams;

  const [articles, categories] = await Promise.all([
    listPublishedArticles(),
    listCategories(),
  ]);

  const active = categories.find((row) => row.name === category)?.name ?? null;
  const results = filterArticles(articles, { category: active, query: q ?? null });

  const chipHref = (next: { category?: string | null; q?: string | null }) => {
    const merged = new URLSearchParams();
    const nextCategory = "category" in next ? next.category : active;
    const nextQuery = "q" in next ? next.q : q;
    if (nextCategory) merged.set("category", nextCategory);
    if (nextQuery) merged.set("q", nextQuery);
    const search = merged.toString();
    return search ? `/staff/routines?${search}` : "/staff/routines";
  };

  return (
    <main className="mx-auto max-w-2xl px-4 pb-20 pt-6">
      <h1 className="text-2xl font-semibold tracking-tight">Rutiner</h1>
      <p className="mt-1 text-zinc-600">Hur vi gör saker i butik.</p>

      <form action="/staff/routines" className="mt-4">
        {active ? <input type="hidden" name="category" value={active} /> : null}
        <label htmlFor="routine-search" className="sr-only">
          Sök i rutiner
        </label>
        <div className="flex gap-2">
          <input
            id="routine-search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Sök, t.ex. stängning"
            className="h-12 min-w-0 flex-1 rounded-2xl border border-zinc-200 px-4 text-base outline-none transition focus:border-zinc-400"
          />
          <button
            type="submit"
            className="h-12 shrink-0 rounded-2xl bg-zinc-900 px-5 font-semibold text-white"
          >
            Sök
          </button>
        </div>
      </form>

      {categories.length > 0 ? (
        <div className="mt-4 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <Link
            href={chipHref({ category: null })}
            className={`h-10 shrink-0 rounded-full border px-4 text-sm font-medium leading-[2.5rem] ${
              active ? "border-zinc-200 bg-white text-zinc-600" : "border-zinc-900 bg-zinc-900 text-white"
            }`}
          >
            Alla
          </Link>
          {categories.map((row) => (
            <Link
              key={row.id}
              href={chipHref({ category: row.name })}
              className={`h-10 shrink-0 rounded-full border px-4 text-sm font-medium leading-[2.5rem] ${
                active === row.name
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-600"
              }`}
            >
              {row.name}
            </Link>
          ))}
        </div>
      ) : null}

      {articles.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-zinc-500">
          Inga publicerade rutiner än. En administratör skriver dem under{" "}
          <span className="font-mono">/admin/routines</span>.
        </p>
      ) : results.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-zinc-500">
          Inget träffade {q ? `“${q}”` : "filtret"}.{" "}
          <Link href="/staff/routines" className="underline underline-offset-4">
            Visa alla
          </Link>
        </p>
      ) : (
        <ul className="mt-5 space-y-2">
          {results.map((article) => (
            <li key={article.id}>
              <Link
                href={`/staff/routines/${article.slug}`}
                className="block rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition active:scale-[0.99] hover:border-zinc-300"
              >
                <p className="font-semibold tracking-tight">{article.title}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {article.category ? `${article.category} · ` : ""}
                  senast uppdaterad {formatDateTime(article.updatedAt)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
