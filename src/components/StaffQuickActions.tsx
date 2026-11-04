import Link from "next/link";
import { getSessionUser } from "@/lib/session";

/**
 * What staff reach for mid-shift, on the landing page.
 *
 * Only for signed-in users: /staff itself is public, and none of these mean
 * anything without a store to attribute them to.
 */
export default async function StaffQuickActions() {
  const user = await getSessionUser();
  if (!user) return null;

  return (
    <section className="mt-5 grid gap-2 sm:grid-cols-2">
      <Link
        href="/store/issues/new"
        className="flex min-h-16 items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm transition active:scale-[0.99] hover:border-zinc-300"
      >
        <span aria-hidden className="text-2xl">🛠️</span>
        <span className="min-w-0">
          <span className="block font-semibold tracking-tight">Problemrapport</span>
          <span className="block text-sm text-zinc-500">
            Skadad vara, fel etikett, trasigt
          </span>
        </span>
      </Link>

      <Link
        href="/staff/routines"
        className="flex min-h-16 items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm transition active:scale-[0.99] hover:border-zinc-300"
      >
        <span aria-hidden className="text-2xl">📘</span>
        <span className="min-w-0">
          <span className="block font-semibold tracking-tight">Rutiner</span>
          <span className="block text-sm text-zinc-500">Hur vi gör saker i butik</span>
        </span>
      </Link>

      <Link
        href="/requests/new"
        className="flex min-h-16 items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm transition active:scale-[0.99] hover:border-zinc-300"
      >
        <span aria-hidden className="text-2xl">💬</span>
        <span className="min-w-0">
          <span className="block font-semibold tracking-tight">Kundönskemål</span>
          <span className="block text-sm text-zinc-500">
            Kunden frågade efter något vi inte hade
          </span>
        </span>
      </Link>

      <Link
        href="/transfers"
        className="flex min-h-16 items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm transition active:scale-[0.99] hover:border-zinc-300"
      >
        <span aria-hidden className="text-2xl">📦</span>
        <span className="min-w-0">
          <span className="block font-semibold tracking-tight">Överföringar</span>
          <span className="block text-sm text-zinc-500">Låna varor mellan butiker</span>
        </span>
      </Link>
    </section>
  );
}
