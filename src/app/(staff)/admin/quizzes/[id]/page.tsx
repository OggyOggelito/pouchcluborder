import Link from "next/link";
import { notFound } from "next/navigation";
import {
  deleteQuestionAction,
  reorderQuestionAction,
  saveQuestionAction,
  saveQuizAction,
} from "@/lib/quiz-actions";
import { prisma } from "@/lib/db";
import { getQuiz } from "@/lib/repositories/quizzes";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

const FIELD =
  "mt-1 w-full bg-raised rounded-xl border border-control px-3 py-2 text-[15px] text-ink placeholder:text-muted outline-none transition focus:border-primary";

export default async function EditQuizPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [quiz, brands] = await Promise.all([
    getQuiz(id),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!quiz) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-6">
      <Link href="/admin/quizzes" className="inline-flex h-9 items-center text-sm text-muted underline underline-offset-4">
        ← Alla quiz
      </Link>

      <form action={saveQuizAction} className="mt-4 rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <input type="hidden" name="id" value={quiz.id} />
        <label htmlFor="title" className="block text-sm font-medium text-ink">Titel</label>
        <input id="title" name="title" defaultValue={quiz.title} className={FIELD} />

        <label htmlFor="description" className="mt-4 block text-sm font-medium text-ink">
          Beskrivning
        </label>
        <textarea id="description" name="description" rows={2} defaultValue={quiz.description ?? ""} className={FIELD} />

        <label htmlFor="brandId" className="mt-4 block text-sm font-medium text-ink">Varumärke</label>
        <select id="brandId" name="brandId" defaultValue="" className={FIELD}>
          <option value="">— inget —</option>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.id}>{brand.name}</option>
          ))}
        </select>

        <label className="mt-4 flex items-center gap-2">
          <input type="checkbox" name="published" defaultChecked={quiz.published} className="h-5 w-5 rounded" />
          <span className="text-sm">Publicerad — syns för personalen</span>
        </label>

        <button type="submit" className="mt-4 h-11 w-full rounded-xl bg-primary font-medium text-on-primary">
          Spara quiz
        </button>
      </form>

      <h2 className="mt-8 text-lg font-semibold tracking-tight">Frågor ({quiz.questions.length})</h2>

      <ul className="mt-3 space-y-3">
        {quiz.questions.map((question, index) => (
          <li key={question.id} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
            <form action={saveQuestionAction} className="space-y-3">
              <input type="hidden" name="quizId" value={quiz.id} />
              <input type="hidden" name="questionId" value={question.id} />
              <textarea name="text" rows={2} defaultValue={question.text} aria-label="Fråga" className={FIELD} />
              {[0, 1, 2, 3].map((optionIndex) => (
                <div key={optionIndex} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correctOption"
                    value={optionIndex}
                    defaultChecked={question.correctOption === optionIndex}
                    aria-label={`Rätt svar: alternativ ${optionIndex + 1}`}
                    className="h-5 w-5"
                  />
                  <input
                    name={`option${optionIndex}`}
                    defaultValue={question.options[optionIndex] ?? ""}
                    placeholder={`Alternativ ${optionIndex + 1}`}
                    aria-label={`Alternativ ${optionIndex + 1}`}
                    className="min-h-tap flex-1 bg-raised rounded-xl border border-control px-3 text-sm text-ink placeholder:text-muted outline-none focus:border-primary"
                  />
                </div>
              ))}
              <textarea
                name="explanation"
                rows={2}
                defaultValue={question.explanation ?? ""}
                placeholder="Förklaring (markdown, visas efter svaret)"
                aria-label="Förklaring"
                className={`${FIELD} font-mono text-sm`}
              />
              <button type="submit" className="min-h-tap rounded-xl border border-control px-4 text-sm font-medium transition hover:bg-raised">
                Spara fråga
              </button>
            </form>

            <div className="mt-2 flex gap-2">
              {[["up", "↑", index === 0], ["down", "↓", index === quiz.questions.length - 1]].map(
                ([direction, glyph, disabled]) => (
                  <form key={direction as string} action={reorderQuestionAction}>
                    <input type="hidden" name="quizId" value={quiz.id} />
                    <input type="hidden" name="questionId" value={question.id} />
                    <input type="hidden" name="direction" value={direction as string} />
                    <button type="submit" disabled={disabled as boolean} aria-label="Flytta" className="h-9 w-9 rounded-lg border border-line text-sm disabled:opacity-30">
                      {glyph as string}
                    </button>
                  </form>
                )
              )}
              <form action={deleteQuestionAction}>
                <input type="hidden" name="quizId" value={quiz.id} />
                <input type="hidden" name="questionId" value={question.id} />
                <button type="submit" className="h-9 rounded-lg border border-danger px-3 text-sm text-danger transition hover:bg-raised">
                  Ta bort
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>

      <section className="mt-6 rounded-2xl border border-dashed border-control p-4">
        <h3 className="font-medium">Lägg till fråga</h3>
        <form action={saveQuestionAction} className="mt-3 space-y-3">
          <input type="hidden" name="quizId" value={quiz.id} />
          <textarea name="text" rows={2} required placeholder="Fråga" aria-label="Fråga" className={FIELD} />
          {[0, 1, 2, 3].map((optionIndex) => (
            <div key={optionIndex} className="flex items-center gap-2">
              <input type="radio" name="correctOption" value={optionIndex} defaultChecked={optionIndex === 0} aria-label={`Rätt svar ${optionIndex + 1}`} className="h-5 w-5" />
              <input name={`option${optionIndex}`} placeholder={`Alternativ ${optionIndex + 1}`} aria-label={`Alternativ ${optionIndex + 1}`} className="min-h-tap flex-1 bg-raised rounded-xl border border-control px-3 text-sm text-ink placeholder:text-muted outline-none focus:border-primary" />
            </div>
          ))}
          <textarea name="explanation" rows={2} placeholder="Förklaring (valfri)" aria-label="Förklaring" className={`${FIELD} font-mono text-sm`} />
          <button type="submit" className="h-11 w-full rounded-xl bg-primary font-medium text-on-primary">
            Lägg till fråga
          </button>
        </form>
      </section>
    </main>
  );
}
