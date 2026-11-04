import Link from "next/link";
import { notFound } from "next/navigation";
import RoutineEditor from "@/components/RoutineEditor";
import { deleteArticleAction } from "@/lib/knowledge-actions";
import { getArticleById, listCategories } from "@/lib/repositories/knowledge";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Rutin — Admin",
};

/**
 * The editor. `/admin/routines/new` creates; any other id edits.
 *
 * "new" is reserved as a segment rather than a separate route, so the editor
 * exists once and both paths render the same component.
 */
export default async function AdminRoutineEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const creating = id === "new";
  const article = creating ? null : await getArticleById(id);
  if (!creating && !article) notFound();

  const categories = (await listCategories()).map((category) => category.name);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-20 pt-6">
      <p className="text-sm">
        <Link href="/admin/routines" className="underline underline-offset-4">
          Alla rutiner
        </Link>
      </p>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">
        {creating ? "Ny rutin" : article!.title}
      </h1>

      <RoutineEditor article={article} categories={categories} />

      {article ? (
        <form action={deleteArticleAction} className="mt-10 border-t border-zinc-100 pt-5">
          <input type="hidden" name="id" value={article.id} />
          <button
            type="submit"
            className="h-11 rounded-xl border border-red-200 px-4 text-sm font-medium text-red-700 transition hover:bg-red-50"
          >
            Ta bort artikeln
          </button>
          <p className="mt-2 text-sm text-zinc-500">
            Avpublicera i stället om den bara ska bort tillfälligt.
          </p>
        </form>
      ) : null}
    </main>
  );
}
