import Link from "next/link";
import { redirect } from "next/navigation";
import { lastDoorWasSupplier } from "@/lib/portal-cookie";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Pouch Club" };

/**
 * The front door.
 *
 * Two choices and the name above them. Nothing else on purpose: a supplier is
 * an external person, and a link into the staff portal — even one that would
 * refuse them — tells them what exists. There is no search, no menu and no
 * "läs mer".
 *
 * Signed-in people never see it. Staff go to Idag; a browser that last came in
 * through the supplier door goes to the supplier portal. The staff session is
 * checked first, so a shared computer cannot send a signed-in manager into the
 * supplier app.
 */
export default async function EntryPage() {
  const staff = await getSessionUser();
  if (staff) redirect("/idag");

  // The supplier session cookie is pinned to /supplier and does not reach
  // this page by design; src/lib/portal-cookie.ts explains the hint used
  // instead, which carries no identity.
  if (await lastDoorWasSupplier()) redirect("/supplier");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16">
      <h1 className="text-center text-3xl font-bold tracking-tight text-ink">Pouch Club</h1>

      <nav aria-label="Välj inloggning" className="mt-10 space-y-4">
        <Link
          href="/login"
          className="flex min-h-20 items-center justify-center rounded-3xl bg-primary px-6 text-xl font-semibold text-on-primary transition active:scale-[0.99]"
        >
          Personal
        </Link>
        <Link
          href="/supplier/login"
          className="flex min-h-20 items-center justify-center rounded-3xl border border-control bg-surface px-6 text-xl font-semibold text-ink transition active:scale-[0.99] hover:border-primary"
        >
          Leverantör
        </Link>
      </nav>
    </main>
  );
}
