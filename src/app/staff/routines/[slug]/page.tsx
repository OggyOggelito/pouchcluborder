import Link from "next/link";
import { notFound } from "next/navigation";
import Markdown from "@/components/Markdown";
import { formatDateTime } from "@/lib/format";
import { getArticleBySlug } from "@/lib/repositories/knowledge";
import { canEditRoutines } from "@/lib/roles";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** The article's own title, so a printed page and a browser tab both name it. */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  return { title: article ? `${article.title} — Rutiner` : "Rutiner — Pouch Club" };
}

/**
 * One routine.
 *
 * Print-friendly: the nav chrome, the back link and the edit link are
 * `print:hidden`, so a routine taped to the stockroom wall is just the title,
 * the date and the text. A draft is visible to an ADMIN only — everyone else
 * gets a 404, so an unpublished URL cannot be shared around the staff group.
 */
export default async function RoutinePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser(`/staff/routines/${slug}`);

  const article = await getArticleBySlug(slug);
  if (!article) notFound();

  const mayEdit = canEditRoutines(user.role);
  if (!article.published && !mayEdit) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 pb-20 pt-6 print:max-w-none print:px-0 print:pb-0 print:pt-0">
      <p className="text-sm print:hidden">
        <Link href="/staff/routines" className="underline underline-offset-4">
          Alla rutiner
        </Link>
      </p>

      {!article.published ? (
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 print:hidden">
          Utkast — syns bara för administratörer.
        </p>
      ) : null}

      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{article.title}</h1>
      <p className="mt-1 text-sm text-zinc-500">
        {article.category ? `${article.category} · ` : ""}
        senast uppdaterad {formatDateTime(article.updatedAt)}
        {article.updatedByName ? ` av ${article.updatedByName}` : ""}
      </p>

      <article className="mt-6">
        <Markdown>{article.body}</Markdown>
      </article>

      {mayEdit ? (
        <p className="mt-10 text-sm print:hidden">
          <Link
            href={`/admin/routines/${article.id}`}
            className="underline underline-offset-4"
          >
            Redigera
          </Link>
        </p>
      ) : null}
    </main>
  );
}
