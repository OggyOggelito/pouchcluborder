"use client";

import { useEffect, useState } from "react";

/**
 * A transient confirmation, announced politely and dismissible.
 *
 * Used for things that succeed and need no decision — an autosaved draft, a
 * copied link. Anything the user must act on is an inline message, not a
 * message that disappears.
 */
export default function Toast({
  message,
  tone = "neutral",
  durationMs = 4000,
  onDone,
}: {
  message: string | null;
  tone?: "neutral" | "warning";
  durationMs?: number;
  onDone?: () => void;
}) {
  const [visible, setVisible] = useState(Boolean(message));

  useEffect(() => {
    setVisible(Boolean(message));
    if (!message) return;

    const timer = setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, durationMs);
    return () => clearTimeout(timer);
  }, [message, durationMs, onDone]);

  if (!message || !visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed inset-x-0 bottom-24 z-40 mx-auto w-fit max-w-[90vw] rounded-2xl px-4 py-3 text-sm font-medium shadow-lg lg:bottom-6 ${
        // A filled yellow toast would read as a button. Toasts are a layer:
        // raised surface with a visible edge.
        tone === "warning"
          ? "border border-warning bg-raised text-warning"
          : "border border-control bg-raised text-ink"
      }`}
    >
      {message}
    </div>
  );
}
