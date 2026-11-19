import Link from "next/link";

/**
 * 404 for anything outside the two apps.
 *
 * The staff group has its own at `(staff)/not-found.tsx`, which keeps the
 * staff chrome around it. This one has no chrome at all, because whoever
 * reached it may be a supplier or nobody we know, and a menu would be the
 * first thing to leak.
 */
export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-xl font-semibold tracking-tight">Sidan finns inte</h1>
      <p className="mt-2 text-ink">Länken kan vara gammal.</p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-tap items-center rounded-2xl bg-primary px-5 font-semibold text-on-primary"
      >
        Till startsidan
      </Link>
    </main>
  );
}
