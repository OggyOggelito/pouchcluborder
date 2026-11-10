import ConfirmButton from "@/components/ui/ConfirmButton";
import { archiveNoteAction, deleteNoteAction, toggleTodoAction } from "@/lib/note-actions";
import { formatDateTime } from "@/lib/format";
import { NOTE_CATEGORY_LABELS } from "@/lib/shift-notes";
import type { NoteView } from "@/lib/repositories/shift-notes";

const BADGE: Record<string, string> = {
  INFO: "bg-raised text-muted",
  IMPORTANT: "bg-raised text-warning",
  TODO: "bg-raised text-primary",
};

/**
 * One note in the feed.
 *
 * A server component: every control is a form posting a server action, so the
 * card works before hydration and the permission check happens where it
 * counts. `canArchive` and `canDelete` only decide what is drawn — the actions
 * check the role again themselves.
 */
export default function ShiftNoteCard({
  note,
  showStore,
  canArchive,
  canDelete,
}: {
  note: NoteView;
  showStore: boolean;
  canArchive: boolean;
  canDelete: boolean;
}) {
  const resolved = note.resolvedAt !== null;
  const archived = note.archivedAt !== null;

  return (
    <article
      className={`rounded-2xl border p-4 ${
        note.category === "IMPORTANT" && !archived
          ? "border-warning bg-raised"
          : "border-line bg-surface"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            BADGE[note.category] ?? BADGE.INFO
          }`}
        >
          {NOTE_CATEGORY_LABELS[note.category]}
        </span>
        {note.pinned && !archived ? (
          <span className="text-xs text-muted">Ligger kvar högst upp</span>
        ) : null}
        {archived ? <span className="text-xs text-muted">Arkiverad</span> : null}
        {showStore ? (
          <span className="text-xs font-medium text-muted">{note.storeName}</span>
        ) : null}
      </div>

      <p
        className={`mt-2 whitespace-pre-wrap text-[17px] leading-relaxed ${
          resolved ? "text-muted line-through" : "text-ink"
        }`}
      >
        {note.text}
      </p>

      <p className="mt-2 text-xs text-muted">
        {note.authorName ?? "Okänd"} · {formatDateTime(note.createdAt)}
      </p>

      {note.category === "TODO" ? (
        <div className="mt-3">
          <form action={toggleTodoAction}>
            <input type="hidden" name="id" value={note.id} />
            <button
              type="submit"
              aria-pressed={resolved}
              className={`flex min-h-12 w-full items-center gap-3 rounded-2xl border px-4 text-left text-sm font-medium transition ${
                resolved
                  ? "border-line bg-raised text-muted"
                  : "border-primary bg-raised text-primary"
              }`}
            >
              <span
                aria-hidden
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-sm ${
                  resolved ? "border-control bg-surface" : "border-primary bg-surface"
                }`}
              >
                {resolved ? "✓" : ""}
              </span>
              <span>{resolved ? "Klar — ta bort bocken" : "Bocka av som klar"}</span>
            </button>
          </form>
          {resolved ? (
            <p className="mt-1 text-xs text-muted">
              Klarmarkerad av {note.resolvedByName ?? "okänd"}
              {note.resolvedAt ? ` · ${formatDateTime(note.resolvedAt)}` : ""}
            </p>
          ) : null}
        </div>
      ) : null}

      {canArchive || canDelete ? (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
          {canArchive ? (
            <form action={archiveNoteAction}>
              <input type="hidden" name="id" value={note.id} />
              <input type="hidden" name="restore" value={archived ? "1" : "0"} />
              <button
                type="submit"
                className="min-h-tap rounded-xl border border-control px-4 text-sm font-medium text-ink transition hover:bg-raised"
              >
                {archived ? "Återställ" : "Arkivera"}
              </button>
            </form>
          ) : null}
          {canDelete ? (
            <form action={deleteNoteAction}>
              <input type="hidden" name="id" value={note.id} />
              <ConfirmButton
                title="Ta bort anteckningen?"
                body="Den försvinner för alla och går inte att få tillbaka. Arkivera i stället om den bara ska bort ur flödet."
                confirmLabel="Ta bort"
                className="min-h-tap rounded-xl border border-danger px-4 text-sm font-medium text-danger transition hover:bg-raised"
              >
                Ta bort
              </ConfirmButton>
            </form>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
