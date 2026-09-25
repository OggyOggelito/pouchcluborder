import NewsFeed from "@/components/NewsFeed";
import { listPublished } from "@/lib/repositories/announcements";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Internal feed — any signed-in staff member, not just managers. */
export default async function NewsPage() {
  await requireUser("/news");
  const items = await listPublished();

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <h1 className="text-xl font-semibold tracking-tight">Nyheter</h1>
      <p className="mt-1 text-zinc-600">Nya produkter, butiksöppningar och annat internt.</p>

      {items.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-zinc-500">
          Inga nyheter än.
        </p>
      ) : (
        <NewsFeed
          items={items.map((item) => ({
            ...item,
            publishedAt: item.publishedAt?.toISOString() ?? null,
            updatedAt: item.updatedAt.toISOString(),
          }))}
        />
      )}
    </main>
  );
}
