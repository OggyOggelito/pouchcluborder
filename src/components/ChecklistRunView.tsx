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
        <p className="text-sm tabular-nums text-muted">
          {progress.done} av {progress.total} klara
        </p>
      </div>

      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-raised"
        role="progressbar"
        aria-valuenow={progress.done}
        aria-valuemin={0}
        aria-valuemax={progress.total}
      >
        <div
          className="h-full rounded-full bg-primary transition-all"
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
                checked ? "border-primary bg-raised" : "border-line bg-surface"
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
                        ? "border-primary bg-raised font-semibold text-ink ring-1 ring-primary"
                        : "border-control text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                  <span className="min-w-0">
                    <span className={`block font-medium ${checked ? "text-muted line-through" : ""}`}>
                      {item.title}
                      {!item.required ? (
                        <span className="ml-2 rounded-full bg-raised px-2 py-0.5 text-xs font-normal text-muted">
                          valfri
                        </span>
                      ) : null}
                    </span>
                    {checked && item.checkedByName ? (
                      <span className="mt-0.5 block text-xs text-muted">
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
                  className="min-h-tap flex-1 bg-raised rounded-xl border border-control px-3 text-sm text-ink placeholder:text-muted outline-none transition focus:border-primary"
                />
                <button
                  type="submit"
                  className="min-h-tap shrink-0 rounded-xl border border-control px-3 text-sm font-medium transition hover:bg-raised"
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
