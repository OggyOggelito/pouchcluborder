/** Pure helpers for quizzes — no database, so they are easy to test. */

export type QuizQuestionView = {
  id: string;
  text: string;
  options: string[];
  correctOption: number;
  explanation: string | null;
};

/** Options are stored as a JSON array; a malformed row yields none. */
export function parseOptions(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((option) => String(option)) : [];
  } catch {
    return [];
  }
}

export function serializeOptions(options: string[]): string {
  return JSON.stringify(options.map((option) => option.trim()).filter(Boolean));
}

/** Answers are stored as questionId -> chosen option index. */
export function parseAnswers(value: string | null | undefined): Record<string, number> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function scoreAttempt(
  questions: { id: string; correctOption: number }[],
  answers: Record<string, number>
): { score: number; total: number } {
  const score = questions.filter((question) => answers[question.id] === question.correctOption).length;
  return { score, total: questions.length };
}

export function percentage(score: number, total: number): number {
  return total > 0 ? Math.round((score / total) * 100) : 0;
}

/**
 * Shown before a quiz starts. Staff should know their manager can see the
 * result before they answer, not after.
 */
export const RESULT_VISIBILITY_NOTICE =
  "Ditt resultat sparas och syns för dig och för din chef. Du kan göra om quizet hur många gånger du vill — både bästa och senaste försöket sparas.";
