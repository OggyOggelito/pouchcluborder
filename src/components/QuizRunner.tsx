"use client";

import Link from "next/link";
import { useState } from "react";
import Markdown from "@/components/Markdown";
import { submitQuizAttemptAction } from "@/lib/quiz-actions";
import { percentage, RESULT_VISIBILITY_NOTICE, type QuizQuestionView } from "@/lib/quizzes";

type Phase = "intro" | "asking" | "done";

/**
 * One question at a time, with the answer revealed immediately.
 *
 * The correct option is in the payload because feedback has to be instant and
 * offline-tolerant behind the counter. That is acceptable here: these are
 * internal training quizzes, not an assessment anyone is graded on, and the
 * recorded score is recomputed on the server from the stored answers — the
 * browser cannot report a score it did not earn.
 */
export default function QuizRunner({
  quizId,
  title,
  description,
  questions,
}: {
  quizId: string;
  title: string;
  description: string | null;
  questions: QuizQuestionView[];
}) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const question = questions[index];

  function choose(option: number) {
    if (chosen !== null) return;
    setChosen(option);
    setAnswers((current) => ({ ...current, [question.id]: option }));
  }

  async function next() {
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      setChosen(null);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      setResult(await submitQuizAttemptAction(quizId, answers));
      setPhase("done");
    } catch {
      setError("Kunde inte spara resultatet. Försök igen.");
    } finally {
      setSaving(false);
    }
  }

  function restart() {
    setPhase("asking");
    setIndex(0);
    setChosen(null);
    setAnswers({});
    setResult(null);
  }

  if (phase === "intro") {
    return (
      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-2 text-zinc-600">{description}</p> : null}
        <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          {RESULT_VISIBILITY_NOTICE}
        </p>
        <p className="mt-3 text-sm text-zinc-500">{questions.length} frågor.</p>
        <button
          type="button"
          onClick={() => setPhase("asking")}
          disabled={questions.length === 0}
          className="mt-4 h-12 w-full rounded-2xl bg-zinc-900 px-6 font-semibold text-white transition active:scale-[0.99] disabled:bg-zinc-200 disabled:text-zinc-500"
        >
          {questions.length === 0 ? "Inga frågor än" : "Starta"}
        </button>
      </section>
    );
  }

  if (phase === "done" && result) {
    return (
      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm uppercase tracking-wide text-zinc-500">Resultat</p>
        <p className="mt-2 text-4xl font-semibold tabular-nums">
          {result.score}/{result.total}
        </p>
        <p className="mt-1 text-zinc-600">{percentage(result.score, result.total)} % rätt</p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={restart}
            className="h-12 rounded-2xl bg-zinc-900 font-semibold text-white transition active:scale-[0.99]"
          >
            Gör om quizet
          </button>
          <Link
            href="/staff/quizzes"
            className="flex h-12 items-center justify-center rounded-2xl border border-zinc-200 font-medium transition hover:bg-zinc-50"
          >
            Till alla quiz
          </Link>
        </div>
      </section>
    );
  }

  const correct = chosen !== null && chosen === question.correctOption;

  return (
    <section className="mt-6">
      <p className="text-sm text-zinc-500">
        Fråga {index + 1} av {questions.length}
      </p>
      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200"
        role="progressbar"
        aria-valuenow={index + 1}
        aria-valuemin={1}
        aria-valuemax={questions.length}
      >
        <div
          className="h-full rounded-full bg-zinc-900 transition-all"
          style={{ width: `${((index + 1) / questions.length) * 100}%` }}
        />
      </div>

      <h1 className="mt-4 text-xl font-semibold tracking-tight">{question.text}</h1>

      <ul className="mt-4 space-y-2">
        {question.options.map((option, optionIndex) => {
          const isChosen = chosen === optionIndex;
          const isCorrect = optionIndex === question.correctOption;
          const revealed = chosen !== null;

          return (
            <li key={option}>
              <button
                type="button"
                onClick={() => choose(optionIndex)}
                disabled={revealed}
                className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-[15px] transition ${
                  revealed && isCorrect
                    ? "border-brand-600 bg-brand-50 font-medium"
                    : revealed && isChosen
                      ? "border-red-300 bg-red-50"
                      : "border-zinc-200 bg-white hover:border-zinc-300"
                }`}
              >
                <span aria-hidden className="w-5 shrink-0 text-center">
                  {revealed && isCorrect ? "✓" : revealed && isChosen ? "✕" : ""}
                </span>
                <span>{option}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {chosen !== null ? (
        <div
          role="status"
          className={`mt-4 rounded-2xl p-4 ${correct ? "bg-brand-50" : "bg-zinc-100"}`}
        >
          <p className="font-medium">{correct ? "Rätt!" : "Inte riktigt."}</p>
          {question.explanation ? (
            <div className="mt-2 text-sm">
              <Markdown>{question.explanation}</Markdown>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={next}
        disabled={chosen === null || saving}
        className="mt-5 h-12 w-full rounded-2xl bg-zinc-900 px-6 font-semibold text-white transition active:scale-[0.99] disabled:bg-zinc-200 disabled:text-zinc-500"
      >
        {saving
          ? "Sparar…"
          : index + 1 < questions.length
            ? "Nästa fråga"
            : "Visa resultat"}
      </button>
    </section>
  );
}
