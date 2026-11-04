"use client";

import { useEffect } from "react";

/**
 * The app-wide error boundary.
 *
 * Before this there was no `error.tsx` anywhere, so a failed query fell
 * through to the framework's own screen — in English, with no way back.
 *
 * The message is deliberately generic. `error.message` from a server component
 * is already redacted in production, and a query string or a stack is not
 * something to put in front of a shop floor.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is what ties this screen to a server log line.
    console.error("Unhandled error", error.digest ?? error.message);
  }, [error]);

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-amber-900">
          Något gick fel
        </h1>
        <p className="mt-2 text-amber-900">
          Sidan kunde inte visas. Det är appen som strular, inte du.
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="min-h-tap flex-1 rounded-2xl bg-zinc-900 px-5 font-semibold text-white"
          >
            Försök igen
          </button>
          <a
            href="/"
            className="flex min-h-tap flex-1 items-center justify-center rounded-2xl border border-amber-300 px-5 font-medium text-amber-900"
          >
            Till startsidan
          </a>
        </div>

        {error.digest ? (
          <p className="mt-4 text-xs text-amber-800">
            Felkod: <span className="font-mono">{error.digest}</span>
          </p>
        ) : null}
      </div>
    </main>
  );
}
