"use client";

import { useActionState, useRef, useState } from "react";
import { createNoteAction, type NoteFormState } from "@/lib/note-actions";
import { NO_PERSONAL_DATA_SHORT } from "@/lib/privacy";
import {
  MAX_NOTE_LENGTH,
  NOTE_CATEGORIES,
  NOTE_CATEGORY_HELP,
  NOTE_CATEGORY_LABELS,
  type NoteCategory,
} from "@/lib/shift-notes";
import type { StoreSummary } from "@/lib/repositories/stores";

/**
 * The one-tap input at the top of the feed.
 *
 * Default category is INFO, so leaving a note is type-and-send; the two other
 * categories are one tap away. The form resets itself on success rather than
 * navigating, because the next thing you do is usually write another one.
 */
export default function ShiftNoteComposer({
  stores,
  defaultStoreId,
}: {
  stores: StoreSummary[];
  defaultStoreId: string;
}) {
  const [storeId, setStoreId] = useState(defaultStoreId || (stores[0]?.id ?? ""));
  const [category, setCategory] = useState<NoteCategory>("INFO");
  const [text, setText] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, pending] = useActionState<NoteFormState, FormData>(
    async (previous, formData) => {
      const result = await createNoteAction(previous, formData);
      if (!result.error) {
        setText("");
        setCategory("INFO");
      }
      return result;
    },
    { error: null }
  );

  return (
    <form
      ref={formRef}
      action={formAction}
      className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
    >
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="category" value={category} />

      {stores.length > 1 ? (
        <div className="mb-3">
          <label htmlFor="note-store" className="block text-sm font-medium text-zinc-700">
            Butik
          </label>
          <select
            id="note-store"
            value={storeId}
            onChange={(event) => setStoreId(event.target.value)}
            className="mt-1 h-12 w-full rounded-2xl border border-zinc-200 px-4 text-base outline-none transition focus:border-zinc-400"
          >
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <label htmlFor="note-text" className="block text-sm font-medium text-zinc-700">
        Till nästa skift
      </label>
      <textarea
        id="note-text"
        name="text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={3}
        maxLength={MAX_NOTE_LENGTH}
        placeholder="t.ex. Kylen i lagret står på 8 grader, vaktmästaren är kontaktad."
        className="mt-1 w-full rounded-2xl border border-zinc-200 px-4 py-3 text-base outline-none transition focus:border-zinc-400"
      />
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <p className="text-sm text-zinc-500">{NO_PERSONAL_DATA_SHORT}</p>
        <span className="shrink-0 text-xs text-zinc-400">
          {text.length}/{MAX_NOTE_LENGTH}
        </span>
      </div>

      <fieldset className="mt-3">
        <legend className="text-sm font-medium text-zinc-700">Typ</legend>
        <div className="mt-2 flex gap-2">
          {NOTE_CATEGORIES.map((candidate) => (
            <button
              key={candidate}
              type="button"
              onClick={() => setCategory(candidate)}
              aria-pressed={category === candidate}
              className={`h-12 flex-1 rounded-2xl border text-sm font-medium transition ${
                category === candidate
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-600"
              }`}
            >
              {NOTE_CATEGORY_LABELS[candidate]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-zinc-500">{NOTE_CATEGORY_HELP[category]}</p>
      </fieldset>

      {state.error ? (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || !text.trim()}
        className="mt-4 h-14 w-full rounded-2xl bg-zinc-900 px-6 text-lg font-semibold text-white transition active:scale-[0.99] disabled:bg-zinc-200 disabled:text-zinc-400"
      >
        {pending ? "Sparar…" : "Lägg till anteckning"}
      </button>
    </form>
  );
}
