"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { serializeOptions } from "@/lib/quizzes";
import { recordAttempt } from "@/lib/repositories/quizzes";
import { requireAdmin, requireUser } from "@/lib/session";

/**
 * Saves an attempt. The browser sends which option was chosen; the score is
 * recomputed server-side from the stored answers, so a tampered request can
 * record a wrong answer but not a wrong score.
 */
export async function submitQuizAttemptAction(
  quizId: string,
  answers: Record<string, number>
): Promise<{ score: number; total: number }> {
  const user = await requireUser("/staff/quizzes");

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { published: true },
  });
  if (!quiz?.published) throw new Error("Quiz is not published.");

  const result = await recordAttempt({ quizId, userId: user.id, answers });
  revalidatePath("/staff/quizzes");
  revalidatePath("/admin/quizzes/results");
  return result;
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export async function saveQuizAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const data = {
    title,
    description: String(formData.get("description") ?? "").trim() || null,
    brandId: String(formData.get("brandId") ?? "") || null,
    published: formData.get("published") === "on",
  };

  if (id) {
    await prisma.quiz.update({ where: { id }, data });
    revalidatePath(`/admin/quizzes/${id}`);
  } else {
    const created = await prisma.quiz.create({ data, select: { id: true } });
    revalidatePath("/admin/quizzes");
    redirect(`/admin/quizzes/${created.id}`);
  }

  revalidatePath("/admin/quizzes");
  revalidatePath("/staff/quizzes");
}

export async function saveQuestionAction(formData: FormData) {
  await requireAdmin();

  const quizId = String(formData.get("quizId") ?? "");
  const questionId = String(formData.get("questionId") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  if (!quizId || !text) return;

  const options = [0, 1, 2, 3]
    .map((index) => String(formData.get(`option${index}`) ?? "").trim())
    .filter(Boolean);
  if (options.length < 2) return;

  const correctOption = Math.min(
    Math.max(Number(formData.get("correctOption") ?? 0), 0),
    options.length - 1
  );

  const data = {
    text,
    options: serializeOptions(options),
    correctOption,
    explanation: String(formData.get("explanation") ?? "").trim() || null,
  };

  if (questionId) {
    await prisma.quizQuestion.update({ where: { id: questionId }, data });
  } else {
    const last = await prisma.quizQuestion.findFirst({
      where: { quizId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    await prisma.quizQuestion.create({
      data: { ...data, quizId, position: (last?.position ?? -1) + 1 },
    });
  }

  revalidatePath(`/admin/quizzes/${quizId}`);
}

export async function deleteQuestionAction(formData: FormData) {
  await requireAdmin();
  const questionId = String(formData.get("questionId") ?? "");
  const quizId = String(formData.get("quizId") ?? "");
  if (!questionId) return;

  await prisma.quizQuestion.delete({ where: { id: questionId } });
  revalidatePath(`/admin/quizzes/${quizId}`);
}

export async function reorderQuestionAction(formData: FormData) {
  await requireAdmin();

  const quizId = String(formData.get("quizId") ?? "");
  const questionId = String(formData.get("questionId") ?? "");
  const direction = formData.get("direction") === "up" ? "up" : "down";
  if (!quizId || !questionId) return;

  const questions = await prisma.quizQuestion.findMany({
    where: { quizId },
    orderBy: { position: "asc" },
    select: { id: true, position: true },
  });

  const index = questions.findIndex((question) => question.id === questionId);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= questions.length) return;

  await prisma.$transaction([
    prisma.quizQuestion.update({
      where: { id: questions[index].id },
      data: { position: questions[swapWith].position },
    }),
    prisma.quizQuestion.update({
      where: { id: questions[swapWith].id },
      data: { position: questions[index].position },
    }),
  ]);

  revalidatePath(`/admin/quizzes/${quizId}`);
}
