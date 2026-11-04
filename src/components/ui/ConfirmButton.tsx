"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * A submit button that asks first.
 *
 * Wraps the button rather than replacing the form, so the server action it
 * submits to is unchanged and the confirmation is purely a front-stop. The
 * dialog is focus-trapped to its two buttons, closes on Escape, and returns
 * focus to the trigger — `window.confirm` does none of that and cannot be
 * written in Swedish consistently across browsers.
 */
export default function ConfirmButton({
  children,
  className,
  title,
  body,
  confirmLabel = "Ja, fortsätt",
  cancelLabel = "Avbryt",
  tone = "danger",
}: {
  children: React.ReactNode;
  className?: string;
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "neutral";
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <button
            type="button"
            aria-label={cancelLabel}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-zinc-900/40"
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl"
          >
            <h2 id={titleId} className="text-lg font-semibold tracking-tight">
              {title}
            </h2>
            {body ? <p className="mt-1 text-sm text-zinc-600">{body}</p> : null}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                className="min-h-tap flex-1 rounded-2xl border border-zinc-200 px-4 font-medium transition hover:bg-zinc-50"
              >
                {cancelLabel}
              </button>
              {/* The real submit. Inside the caller's <form>, so it posts to
                  whatever action that form carries. */}
              <button
                ref={confirmRef}
                type="submit"
                className={`min-h-tap flex-1 rounded-2xl px-4 font-semibold text-white transition ${
                  tone === "danger" ? "bg-red-700" : "bg-zinc-900"
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
