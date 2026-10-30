import Link from "next/link";
import { saveQuizAction } from "@/lib/quiz-actions";
import { prisma } from "@/lib/db";
import { listQuizzes } from "@/lib/repositories/quizzes";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

const FIELD =
  "mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-[15px] outline-none transition focus:border-zinc-400";

export default async function AdminQuizzesPage() {
  await requireAdmin();
  const [quizzes, brands] = await Promise.all([
    listQuizzes(false),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-6">
      <h1 className="text-xl font-semibold tracking-tight">Quiz</h1>
      <p className="mt-1 text-zinc-600">
        {quizzes.filter((quiz) => quiz.published).length} publicerade av {quizzes.length}.{" "}
        <Link href="/admin/quizzes/results" className="underline underline-offset-4">
          Resultat
        </Link>
      </p>

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight">Nytt quiz</h2>
        <form action={saveQuizAction} className="mt-4 space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-zinc-700">Titel</label>
            <input id="title" name="title" required className={FIELD} />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-zinc-700">
              Beskrivning (valfri)
            </label>
            <textarea id="description" name="description" rows={2} className={FIELD} />
          </div>
          <div>
            <label htmlFor="brandId" className="block text-sm font-medium text-zinc-700">
              Varumärke (valfritt)
            </label>
            <select id="brandId" name="brandId" defaultValue="" className={FIELD}>
              <option value="">— inget —</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>{brand.name}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="h-12 w-full rounded-2xl bg-zinc-900 font-semibold text-white">
            Skapa quiz
          </button>
        </form>
      </section>

      <ul className="mt-6 space-y-2">
        {quizzes.map((quiz) => (
          <li key={quiz.id}>
            <Link
              href={`/admin/quizzes/${quiz.id}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm transition hover:border-zinc-300"
            >
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">{quiz.title}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                      quiz.published ? "bg-brand-50 text-brand-700" : "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    {quiz.published ? "Publicerad" : "Utkast"}
                  </span>
                </span>
                <span className="mt-0.5 block text-sm text-zinc-500">
                  {quiz.questionCount} frågor{quiz.brandName ? ` · ${quiz.brandName}` : ""}
                </span>
              </span>
              <span aria-hidden className="text-zinc-400">›</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
