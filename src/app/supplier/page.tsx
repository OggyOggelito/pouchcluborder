import Link from "next/link";
import { stockholmDateKey } from "@/lib/checklists";
import { countNewDecisions, listBookingsForBrand } from "@/lib/repositories/demo-days";
import { salesStatsEnabled } from "@/lib/sales";
import { formatLongDateString } from "@/lib/schedule/time";
import { requireSupplier } from "@/lib/supplier-session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Leverantörsportal — Pouch Club" };

/**
 * The supplier's start page.
 *
 * Carries the one thing this app cannot send by email: a decision on a
 * booking. There is no mail transport here, so "2 svar sedan sist" is how a
 * supplier finds out — and opening the bookings page is what clears it.
 */
export default async function SupplierHomePage({
  searchParams,
}: {
  searchParams: Promise<{ losenord?: string }>;
}) {
  const supplier = await requireSupplier("/supplier");
  const { losenord } = await searchParams;

  const today = stockholmDateKey();
  const [bookings, newDecisions] = await Promise.all([
    listBookingsForBrand({ brandId: supplier.brand.id, from: today }),
    countNewDecisions({ brandId: supplier.brand.id, since: supplier.bookingsSeenAt }),
  ]);

  const confirmed = bookings.filter((booking) => booking.status === "CONFIRMED");
  const waiting = bookings.filter((booking) => booking.status === "REQUESTED");
  const next = confirmed[0] ?? null;

  return (
    <main className="px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{supplier.brand.name}</h1>
      <p className="mt-1 text-muted">Inloggad som {supplier.email}.</p>

      {losenord ? (
        <p role="status" className="mt-4 rounded-xl border border-success bg-raised p-3 text-sm text-success">
          <span aria-hidden="true">✓ </span>Lösenordet är bytt.
        </p>
      ) : null}

      {newDecisions > 0 ? (
        <Link
          href="/supplier/bokningar"
          className="mt-5 block rounded-2xl border border-primary bg-surface p-5 shadow-sm transition active:scale-[0.99]"
        >
          <span className="block font-semibold tracking-tight">
            {newDecisions === 1 ? "1 svar sedan sist" : `${newDecisions} svar sedan sist`}
          </span>
          <span className="mt-1 block text-sm text-muted">
            Butikerna har svarat på era förfrågningar.
          </span>
        </Link>
      ) : null}

      {next ? (
        <div className="mt-3 rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <span className="block font-semibold tracking-tight">Nästa demodag</span>
          <span className="mt-1 block text-sm capitalize text-muted">
            {next.store.name} · {formatLongDateString(next.date)}
          </span>
        </div>
      ) : null}

      <nav aria-label="Genvägar" className="mt-6 space-y-3">
        <Link
          href="/supplier/boka"
          className="block rounded-2xl bg-primary p-5 text-on-primary transition active:scale-[0.99]"
        >
          <span className="block text-lg font-semibold tracking-tight">Boka demodag</span>
          <span className="mt-1 block text-sm">
            Välj datum och butiker. Butiken svarar ja eller nej.
          </span>
        </Link>

        <Link
          href="/supplier/bokningar"
          className="block rounded-2xl border border-line bg-surface p-5 shadow-sm transition hover:border-control"
        >
          <span className="block font-semibold tracking-tight">Mina bokningar</span>
          <span className="mt-1 block text-sm text-muted">
            {waiting.length > 0
              ? `${waiting.length} väntar på svar · ${confirmed.length} bekräftade`
              : `${confirmed.length} bekräftade`}
          </span>
        </Link>

        {salesStatsEnabled() ? (
          <Link
            href="/supplier/stats"
            className="block rounded-2xl border border-line bg-surface p-5 shadow-sm transition hover:border-control"
          >
            <span className="block font-semibold tracking-tight">Statistik</span>
            <span className="mt-1 block text-sm text-muted">
              Sålda produkter per dag, produkt och butik.
            </span>
          </Link>
        ) : null}
      </nav>

      <p className="mt-10 text-xs text-muted">
        <Link href="/supplier/byt-losenord" className="underline underline-offset-4">
          Byt lösenord
        </Link>
      </p>
    </main>
  );
}
