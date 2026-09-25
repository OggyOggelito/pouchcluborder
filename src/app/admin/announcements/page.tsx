import Link from "next/link";
import AnnouncementEditor from "@/components/AnnouncementEditor";
import { categoryLabel } from "@/lib/announcements";
import { formatDateTime } from "@/lib/format";
import { listAll } from "@/lib/repositories/announcements";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminAnnouncementsPage() {
  await requireAdmin();
  const announcements = await listAll();
  const published = announcements.filter((item) => item.publishedAt !== null).length;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-6">
      <h1 className="text-xl font-semibold tracking-tight">Nyheter</h1>
      <p className="mt-1 text-zinc-600">
        {published} publicerade av {announcements.length}.{" "}
        <Link href="/news" className="underline underline-offset-4">
          Visa flödet
        </Link>
      </p>

      <div className="mt-6">
        <AnnouncementEditor />
      </div>

      <h2 className="mt-8 text-lg font-semibold tracking-tight">Alla inlägg</h2>
      {announcements.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-zinc-500">
          Inga inlägg än.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {announcements.map((item) => (
            <li key={item.id}>
              <Link
                href={`/admin/announcements/${item.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm transition hover:border-zinc-300"
              >
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    {item.pinned ? <span aria-label="Fäst">📌</span> : null}
                    <span className="truncate font-medium">{item.title}</span>
                    <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                      {categoryLabel(item.category)}
                    </span>
                    {item.publishedAt ? null : (
                      <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                        Utkast
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-sm text-zinc-500">
                    {item.publishedAt
                      ? formatDateTime(item.publishedAt)
                      : `Ändrad ${formatDateTime(item.updatedAt)}`}
                    {item.authorName ? ` · ${item.authorName}` : ""}
                  </span>
                </span>
                <span aria-hidden className="text-zinc-400">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
