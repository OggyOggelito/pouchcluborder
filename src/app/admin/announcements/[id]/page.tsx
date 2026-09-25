import Link from "next/link";
import { notFound } from "next/navigation";
import AnnouncementEditor from "@/components/AnnouncementEditor";
import { getAnnouncement } from "@/lib/repositories/announcements";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function EditAnnouncementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();

  const { id } = await params;
  const announcement = await getAnnouncement(id);
  if (!announcement) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-6">
      <Link
        href="/admin/announcements"
        className="inline-flex h-9 items-center text-sm text-zinc-500 underline underline-offset-4"
      >
        ← Alla inlägg
      </Link>
      <div className="mt-4">
        <AnnouncementEditor announcement={announcement} />
      </div>
    </main>
  );
}
