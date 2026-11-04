import Link from "next/link";
import { createCategoryAction, deleteCategoryAction } from "@/lib/knowledge-actions";
import { formatDateTime } from "@/lib/format";
import { listAllArticles, listCategories } from "@/lib/repositories/knowledge";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Rutiner — Admin",
};

/** The article list plus category management. ADMIN only. */
export default async function AdminRoutinesPage() {
  await requireAdmin();

  const [articles, categories] = await Promise.all([listAllArticles(), listCategories()]);

  const published = articles.filter((article) => article.published).length;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-20 pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Rutiner</h1>
        <Link href="/staff/routines" className="text-sm font-medium underline underline-offset-4">
          Visa personalsidan
        </Link>
      </div>
      <p className="mt-1 text-sm text-zinc-500">
        {articles.length === 1 ? "1 artikel" : `${articles.length} artiklar`},{" "}
        {published === 1 ? "1 publicerad" : `${published} publicerade`}.
      </p>

      <Link
        href="/admin/routines/new"
        className="mt-4 flex h-12 items-center justify-center rounded-2xl bg-zinc-900 px-6 font-semibold text-white transition active:scale-[0.99]"
      >
        Ny artikel
      </Link>

      {articles.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-zinc-500">
          Inga artiklar än. Kör <span className="font-mono">npm run seed:routines</span> för
          exempelartikeln, eller skriv en egen.
        </p>
      ) : (
        <ul className="mt-5 space-y-2">
          {articles.map((article) => (
            <li key={article.id}>
              <Link
                href={`/admin/routines/${article.id}`}
                className="block rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold tracking-tight">{article.title}</span>
                  {article.published ? null : (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">
                      Utkast
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {article.category ? `${article.category} · ` : "Ingen kategori · "}
                  senast uppdaterad {formatDateTime(article.updatedAt)}
                  {article.updatedByName ? ` av ${article.updatedByName}` : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight">Kategorier</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Chipsen på personalsidan, i den här ordningen.
        </p>

        {categories.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {categories.map((category) => (
              <li
                key={category.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-zinc-50 px-3 py-2"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-medium">{category.name}</span>
                  <span className="block text-xs text-zinc-500">
                    {category.articleCount === 1 ? "1 artikel" : `${category.articleCount} artiklar`}
                  </span>
                </span>
                <form action={deleteCategoryAction}>
                  <input type="hidden" name="id" value={category.id} />
                  <button
                    type="submit"
                    className="h-10 shrink-0 rounded-xl border border-zinc-200 px-3 text-sm font-medium"
                  >
                    Ta bort
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">Inga kategorier än.</p>
        )}

        <p className="mt-3 text-sm text-zinc-500">
          Att ta bort en kategori rör inte artiklarna — de behåller sin text och slutar bara
          matcha ett chip.
        </p>

        <form action={createCategoryAction} className="mt-4 flex gap-2">
          <label htmlFor="category-name" className="sr-only">
            Ny kategori
          </label>
          <input
            id="category-name"
            name="name"
            placeholder="t.ex. Kassa"
            className="h-11 min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 text-[15px] outline-none transition focus:border-zinc-400"
          />
          <button
            type="submit"
            className="h-11 shrink-0 rounded-xl border border-zinc-200 px-4 text-sm font-medium"
          >
            Lägg till
          </button>
        </form>
      </section>
    </main>
  );
}
