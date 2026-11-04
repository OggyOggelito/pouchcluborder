"use client";

import { useState } from "react";
import { TERMS, type TermKey } from "@/lib/terms";

/**
 * The "?" next to a word like *stock*.
 *
 * A toggle rather than a hover tooltip, because the shop floor is a
 * touchscreen and there is no hover there. Collapsed it is a 44px target; open
 * it is one sentence from src/lib/terms.ts.
 */
export default function TermHint({ term }: { term: TermKey }) {
  const [open, setOpen] = useState(false);
  const definition = TERMS[term];

  return (
    <span className="inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        // The visible circle stays small so it sits inside a line of text;
        // the button around it is a full 44px target.
        className="-my-3 ml-0.5 grid h-tap w-tap place-items-center rounded-full"
      >
        <span
          aria-hidden
          className="grid h-6 w-6 place-items-center rounded-full border border-zinc-300 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-100"
        >
          ?
        </span>
        <span className="sr-only">Vad betyder {definition.one}?</span>
      </button>

      {open ? (
        <span className="ml-2 inline-block rounded-xl bg-zinc-100 px-3 py-1.5 text-sm font-normal text-zinc-700">
          {definition.explanation}
        </span>
      ) : null}
    </span>
  );
}
