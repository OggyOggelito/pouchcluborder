import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import { countOpenTodos, latestNotes } from "@/lib/repositories/shift-notes";
import { listStores } from "@/lib/repositories/stores";
import { canAccessAllStores } from "@/lib/roles";
import { NOTE_CATEGORY_LABELS } from "@/lib/shift-notes";
import { getSessionUser } from "@/lib/session";

/**
 * The home-screen card: the latest three notes and how many TODOs are open.
 *
 * Renders nothing when signed out or when the account has no store, so the
 * public guide page stays unchanged for a visitor.
 */
export default async function ShiftNotesWidget() {
  const user = await getSessionUser();
  if (!user) return null;

  const stores = canAccessAllStores(user.role) ? await listStores() : user.stores;
  if (stores.length === 0) return null;

  const storeIds = stores.map((store) => store.id);
  const [notes, openTodos] = await Promise.all([
    latestNotes(storeIds, 3),
    countOpenTodos(storeIds),
  ]);

  return (
    <section className="mt-5 rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Skiftanteckningar</h2>
        <Link href="/store/notes" className="inline-flex min-h-tap items-center text-sm font-medium underline underline-offset-4">
          Alla anteckningar
        </Link>
      </div>

      <p className="mt-1 text-sm text-muted">
        {openTodos > 0 ? (
          <strong className="text-ink">
            {openTodos === 1 ? "1 öppen punkt att göra." : `${openTodos} öppna punkter att göra.`}
          </strong>
        ) : (
          "Inget att göra ligger öppet."
        )}
      </p>

      {notes.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          Inga anteckningar än.{" "}
          <Link href="/store/notes" className="underline underline-offset-4">
            Skriv den första
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {notes.map((note) => (
            <li key={note.id} className="rounded-xl bg-raised p-3">
              <p className="line-clamp-2 text-[15px] text-ink">{note.text}</p>
              <p className="mt-1 text-xs text-muted">
                {NOTE_CATEGORY_LABELS[note.category]}
                {storeIds.length > 1 ? ` · ${note.storeName}` : ""} ·{" "}
                {note.authorName ?? "Okänd"} · {formatDateTime(note.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
