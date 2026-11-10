import Link from "next/link";
import { notFound } from "next/navigation";
import QuizRunner from "@/components/QuizRunner";
import { getQuiz } from "@/lib/repositories/quizzes";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function StaffQuizPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("/staff/quizzes");

  const { id } = await params;
  const quiz = await getQuiz(id);
  // An unpublished quiz is not reachable by guessing its id.
  if (!quiz || !quiz.published) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 pb-20 pt-6">
      <Link
        href="/staff/quizzes"
        className="inline-flex h-9 items-center text-sm text-muted underline underline-offset-4"
      >
        ← Alla quiz
      </Link>
      <QuizRunner
        quizId={quiz.id}
        title={quiz.title}
        description={quiz.description}
        questions={quiz.questions}
      />
    </main>
  );
}
