import Link from "next/link";
import ShiftNoteCard from "@/components/ShiftNoteCard";
import ShiftNoteComposer from "@/components/ShiftNoteComposer";
import { countOpenTodos, listNotes } from "@/lib/repositories/shift-notes";
import { listStores } from "@/lib/repositories/stores";
import { canAccessAllStores, canArchiveNotes, canDeleteNotes } from "@/lib/roles";
import { ARCHIVE_AFTER_DAYS } from "@/lib/shift-notes";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Skiftanteckningar — Pouch Club",
};

const TABS = [
  { id: "feed", label: "Aktuellt" },
  { id: "archive", label: "Arkiv" },
] as const;

/**
 * The handover feed.
 *
 * Everyone with access to the store may read and write; archiving is for an
 * OWNER or ADMIN and deleting for an ADMIN only. The store scope comes from
 * the account — `?store=` can narrow it but never widen it.
 */
export default async function StoreNotesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; store?: string }>;
}) {
  const user = await requireUser("/store/notes");
  const { tab: tabParam, store: storeParam } = await searchParams;
  const tab = TABS.find((candidate) => candidate.id === tabParam)?.id ?? "feed";

  const stores = canAccessAllStores(user.role) ? await listStores() : user.stores;

  if (stores.length === 0) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-xl font-semibold tracking-tight">Skiftanteckningar</h1>
        <p className="mt-2 text-zinc-600">
          Ditt konto är inte kopplat till någon butik. Be en administratör koppla en.
        </p>
      </main>
    );
  }

  // Narrowing only: an unknown or inaccessible id falls back to every store
  // the account can see.
  const selected = stores.find((store) => store.id === storeParam) ?? null;
  const scopeIds = selected ? [selected.id] : stores.map((store) => store.id);

  const [notes, openTodos] = await Promise.all([
    listNotes({ storeIds: scopeIds, archived: tab === "archive" }),
    countOpenTodos(scopeIds),
  ]);

  const canArchive = canArchiveNotes(user.role);
  const canDelete = canDeleteNotes(user.role);
  const query = (next: Record<string, string>) =>
    `/store/notes?${new URLSearchParams({
      ...(selected ? { store: selected.id } : {}),
      ...next,
    }).toString()}`;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-20 pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Skiftanteckningar</h1>
        <Link href="/store/issues" className="text-sm font-medium underline underline-offset-4">
          Problemrapporter
        </Link>
      </div>
      <p className="mt-1 text-sm text-zinc-500">
        Vad nästa skift behöver veta.{" "}
        {openTodos > 0 ? (
          <strong className="text-zinc-800">
            {openTodos === 1 ? "1 öppen punkt att göra." : `${openTodos} öppna punkter att göra.`}
          </strong>
        ) : (
          "Inget att göra ligger öppet."
        )}
      </p>

      {stores.length > 1 ? (
        <div className="mt-4 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <Link
            href={`/store/notes?tab=${tab}`}
            className={`h-10 shrink-0 rounded-full border px-4 text-sm font-medium leading-[2.5rem] ${
              selected ? "border-zinc-200 bg-white text-zinc-600" : "border-zinc-900 bg-zinc-900 text-white"
            }`}
          >
            Alla butiker
          </Link>
          {stores.map((store) => (
            <Link
              key={store.id}
              href={`/store/notes?tab=${tab}&store=${store.id}`}
              className={`h-10 shrink-0 rounded-full border px-4 text-sm font-medium leading-[2.5rem] ${
                selected?.id === store.id
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-600"
              }`}
            >
              {store.name}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex gap-2">
        {TABS.map((candidate) => (
          <Link
            key={candidate.id}
            href={query({ tab: candidate.id })}
            className={`h-10 flex-1 rounded-full border text-center text-sm font-medium leading-[2.5rem] ${
              candidate.id === tab
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white text-zinc-600"
            }`}
          >
            {candidate.label}
          </Link>
        ))}
      </div>

      {tab === "feed" ? (
        <ShiftNoteComposer stores={stores} defaultStoreId={selected?.id ?? ""} />
      ) : (
        <p className="mt-4 rounded-xl bg-zinc-100 p-3 text-sm text-zinc-600">
          Anteckningar som inte ligger kvar högst upp flyttas hit efter{" "}
          {ARCHIVE_AFTER_DAYS} dagar. Ingenting tas bort automatiskt.
        </p>
      )}

      {notes.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-zinc-500">
          {tab === "feed" ? "Inga anteckningar just nu." : "Arkivet är tomt."}
        </p>
      ) : (
        <ul className="mt-5 space-y-2">
          {notes.map((note) => (
            <li key={note.id}>
              <ShiftNoteCard
                note={note}
                showStore={scopeIds.length > 1}
                canArchive={canArchive}
                canDelete={canDelete}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
