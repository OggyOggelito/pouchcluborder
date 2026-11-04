import Link from "next/link";
import Markdown from "@/components/Markdown";
import {
  saveChecklistNoteAction,
  toggleChecklistItemAction,
} from "@/lib/checklist-actions";
import type { RunView } from "@/lib/repositories/checklists";

const STOCKHOLM_TIME = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Stockholm",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * One checklist run. Server component with plain forms, so ticking works
 * before hydration and on a slow connection behind the counter.
 */
export default function ChecklistRunView({ run }: { run: RunView }) {
  const { progress } = run;

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 className="text-lg font-semibold tracking-tight">{run.title}</h2>
        <p className="text-sm tabular-nums text-zinc-500">
          {progress.done} av {progress.total} klara
        </p>
      </div>

      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-200"
        role="progressbar"
        aria-valuenow={progress.done}
        aria-valuemin={0}
        aria-valuemax={progress.total}
      >
        <div
          className="h-full rounded-full bg-brand-600 transition-all"
          style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
        />
      </div>

      <ul className="mt-4 space-y-2">
        {run.items.map((item) => {
          const checked = item.checkedAt !== null;
          return (
            <li
              key={item.id}
              className={`rounded-2xl border p-4 shadow-sm transition ${
                checked ? "border-brand-200 bg-brand-50/50" : "border-zinc-200 bg-white"
              }`}
            >
              <form action={toggleChecklistItemAction}>
                <input type="hidden" name="itemId" value={item.id} />
                <input type="hidden" name="runId" value={run.id} />
                <input type="hidden" name="checked" value={checked ? "0" : "1"} />
                <button
                  type="submit"
                  className="flex min-h-tap w-full items-start gap-3 py-1 text-left"
                  aria-pressed={checked}
                >
                  <span
                    aria-hidden
                    className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2 text-sm font-bold ${
                      checked
                        ? "border-brand-700 bg-brand-700 text-white"
                        : "border-zinc-300 text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                  <span className="min-w-0">
                    <span className={`block font-medium ${checked ? "text-zinc-500 line-through" : ""}`}>
                      {item.title}
                      {!item.required ? (
                        <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-normal text-zinc-500">
                          valfri
                        </span>
                      ) : null}
                    </span>
                    {checked && item.checkedByName ? (
                      <span className="mt-0.5 block text-xs text-zinc-500">
                        {item.checkedByName} · {STOCKHOLM_TIME.format(item.checkedAt!)}
                      </span>
                    ) : null}
                  </span>
                </button>
              </form>

              {item.description ? (
                <div className="mt-2 pl-10 text-sm">
                  <Markdown>{item.description}</Markdown>
                </div>
              ) : null}

              {item.linkUrl ? (
                <p className="mt-2 pl-10">
                  <Link href={item.linkUrl} className="text-sm underline underline-offset-4">
                    Öppna
                  </Link>
                </p>
              ) : null}

              <form action={saveChecklistNoteAction} className="mt-3 flex gap-2 pl-10">
                <input type="hidden" name="itemId" value={item.id} />
                <input type="hidden" name="runId" value={run.id} />
                <input
                  name="note"
                  defaultValue={item.note ?? ""}
                  placeholder="Anteckning (valfritt)"
                  aria-label={`Anteckning för ${item.title}`}
                  className="min-h-tap flex-1 rounded-xl border border-zinc-200 px-3 text-sm outline-none transition focus:border-zinc-400"
                />
                <button
                  type="submit"
                  className="min-h-tap shrink-0 rounded-xl border border-zinc-200 px-3 text-sm font-medium transition hover:bg-zinc-50"
                >
                  Spara
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
