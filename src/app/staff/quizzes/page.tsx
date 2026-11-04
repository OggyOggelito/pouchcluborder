import Link from "next/link";
import { percentage } from "@/lib/quizzes";
import { listAttemptSummaries, listQuizzes } from "@/lib/repositories/quizzes";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Login required, so attempts can be attributed. */
export default async function StaffQuizzesPage() {
  const user = await requireUser("/staff/quizzes");
  const [quizzes, attempts] = await Promise.all([
    listQuizzes(true),
    // Own results only — never another person's.
    listAttemptSummaries(user.id),
  ]);

  const byQuiz = new Map(attempts.map((attempt) => [attempt.quizId, attempt]));

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <h1 className="text-xl font-semibold tracking-tight">Quiz</h1>
      <p className="mt-1 text-zinc-600">
        Testa dig själv. Du kan göra om ett quiz hur många gånger du vill.
      </p>

      {quizzes.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-zinc-500">
          Inga publicerade quiz än.
        </p>
      ) : (
        <ul className="mt-5 space-y-2">
          {quizzes.map((quiz) => {
            const mine = byQuiz.get(quiz.id);
            return (
              <li key={quiz.id}>
                <Link
                  href={`/staff/quizzes/${quiz.id}`}
                  className="block rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300"
                >
                  <p className="font-medium">{quiz.title}</p>
                  {quiz.description ? (
                    <p className="mt-0.5 line-clamp-2 text-sm text-zinc-500">{quiz.description}</p>
                  ) : null}
                  <p className="mt-1 text-sm text-zinc-500">
                    {quiz.questionCount} frågor
                    {quiz.brandName ? ` · ${quiz.brandName}` : ""}
                    {mine?.best
                      ? ` · bäst ${mine.best.score}/${mine.best.total} (${percentage(mine.best.score, mine.best.total)} %)`
                      : ""}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
