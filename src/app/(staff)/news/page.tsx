import NewsFeed from "@/components/NewsFeed";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import { listPublished } from "@/lib/repositories/announcements";
import { markNewsRead } from "@/lib/repositories/preferences";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Nyheter — Pouch Club",
};

/** Internal feed — any signed-in staff member, not just managers. */
export default async function NewsPage() {
  const user = await requireUser("/news");
  const items = await listPublished();

  // Opening the feed is what "read" means here; there is no per-article read
  // state and nothing in the app needs one. Written during render rather than
  // behind a button, which means the unread badge in the shell — already
  // rendered for this request — clears on the next navigation rather than
  // this one. That reads correctly: the count is still true while you are
  // reading them.
  await markNewsRead(user.id);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <PageHeader
        title="Nyheter"
        description="Nya produkter, butiksöppningar och annat internt."
      />

      {items.length === 0 ? (
        <EmptyState
          title="Inga nyheter än"
          description="Här dyker nya produkter och butiksnyheter upp."
        />
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
