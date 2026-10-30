import { prisma } from "@/lib/db";
import { parseAnswers, parseOptions, scoreAttempt, type QuizQuestionView } from "@/lib/quizzes";

export type QuizSummary = {
  id: string;
  title: string;
  description: string | null;
  brandName: string | null;
  published: boolean;
  questionCount: number;
};

export type QuizDetail = QuizSummary & { questions: QuizQuestionView[] };

export async function listQuizzes(onlyPublished: boolean): Promise<QuizSummary[]> {
  const quizzes = await prisma.quiz.findMany({
    where: onlyPublished ? { published: true } : {},
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      description: true,
      published: true,
      brand: { select: { name: true } },
      _count: { select: { questions: true } },
    },
  });

  return quizzes.map((quiz) => ({
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    brandName: quiz.brand?.name ?? null,
    published: quiz.published,
    questionCount: quiz._count.questions,
  }));
}

export async function getQuiz(id: string): Promise<QuizDetail | null> {
  const quiz = await prisma.quiz.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      published: true,
      brand: { select: { name: true } },
      questions: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          text: true,
          options: true,
          correctOption: true,
          explanation: true,
        },
      },
    },
  });
  if (!quiz) return null;

  return {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    brandName: quiz.brand?.name ?? null,
    published: quiz.published,
    questionCount: quiz.questions.length,
    questions: quiz.questions.map((question) => ({
      id: question.id,
      text: question.text,
      options: parseOptions(question.options),
      correctOption: question.correctOption,
      explanation: question.explanation,
    })),
  };
}

/**
 * Records an attempt. The score is recomputed on the server from the stored
 * correct answers — the browser sends only which option was chosen.
 */
export async function recordAttempt(input: {
  quizId: string;
  userId: string;
  answers: Record<string, number>;
}): Promise<{ score: number; total: number }> {
  const questions = await prisma.quizQuestion.findMany({
    where: { quizId: input.quizId },
    select: { id: true, correctOption: true },
  });

  const { score, total } = scoreAttempt(questions, input.answers);

  await prisma.quizAttempt.create({
    data: {
      quizId: input.quizId,
      userId: input.userId,
      score,
      total,
      answers: JSON.stringify(input.answers),
    },
  });

  return { score, total };
}

export type AttemptSummary = {
  quizId: string;
  quizTitle: string;
  userId: string;
  userName: string;
  userEmail: string;
  storeNames: string[];
  best: { score: number; total: number } | null;
  latest: { score: number; total: number; at: Date } | null;
  attempts: number;
};

/**
 * Best and latest attempt per user and quiz.
 *
 * Callers decide the scope: a staff member passes their own id, an admin
 * passes null for everyone. Never derive the scope from a request parameter.
 */
export async function listAttemptSummaries(userId: string | null): Promise<AttemptSummary[]> {
  const attempts = await prisma.quizAttempt.findMany({
    where: userId ? { userId } : {},
    orderBy: { completedAt: "desc" },
    select: {
      quizId: true,
      score: true,
      total: true,
      completedAt: true,
      quiz: { select: { title: true } },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          storeAccess: { select: { store: { select: { name: true } } } },
        },
      },
    },
  });

  const byKey = new Map<string, AttemptSummary>();

  for (const attempt of attempts) {
    const key = `${attempt.user.id}|${attempt.quizId}`;
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, {
        quizId: attempt.quizId,
        quizTitle: attempt.quiz.title,
        userId: attempt.user.id,
        userName: attempt.user.name ?? attempt.user.email,
        userEmail: attempt.user.email,
        storeNames: attempt.user.storeAccess.map((access) => access.store.name),
        // Ordered newest first, so the first row seen is the latest.
        latest: { score: attempt.score, total: attempt.total, at: attempt.completedAt },
        best: { score: attempt.score, total: attempt.total },
        attempts: 1,
      });
      continue;
    }

    existing.attempts += 1;
    if (!existing.best || attempt.score > existing.best.score) {
      existing.best = { score: attempt.score, total: attempt.total };
    }
  }

  return [...byKey.values()].sort(
    (a, b) => a.userName.localeCompare(b.userName, "sv") || a.quizTitle.localeCompare(b.quizTitle, "sv")
  );
}

export { parseAnswers };
