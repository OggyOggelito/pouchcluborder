import Link from "next/link";
import { categoryLabel } from "@/lib/announcements";
import { listPublished } from "@/lib/repositories/announcements";
import { getSessionUser } from "@/lib/session";

/**
 * The three newest announcements, for the staff landing page.
 *
 * Renders nothing when signed out. /staff is deliberately open to everyone —
 * the brand guide must stay readable without an account — so this widget checks
 * for a session itself rather than the page being gated.
 */
export default async function NewsWidget({ limit = 3 }: { limit?: number }) {
  const user = await getSessionUser();
  if (!user) return null;

  const items = await listPublished(undefined, limit);
  if (items.length === 0) return null;

  return (
    <section className="mt-5 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Nytt</h2>
        <Link href="/news" className="text-sm text-zinc-500 underline underline-offset-4">
          Alla nyheter
        </Link>
      </div>

      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link href="/news" className="group flex items-start gap-2">
              {item.pinned ? <span aria-label="Fäst">📌</span> : null}
              <span className="min-w-0">
                <span className="block truncate font-medium group-hover:underline">
                  {item.title}
                </span>
                <span className="block text-xs text-zinc-400">
                  {categoryLabel(item.category)}
                  {item.publishedAt
                    ? ` · ${item.publishedAt.toLocaleDateString("sv-SE", {
                        day: "numeric",
                        month: "short",
                      })}`
                    : ""}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
