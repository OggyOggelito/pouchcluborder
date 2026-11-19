import Link from "next/link";
import StaffSessionNotice from "@/components/supplier/StaffSessionNotice";
import SupplierNav from "@/components/supplier/SupplierNav";
import { salesStatsEnabled } from "@/lib/sales";
import { getSessionUser } from "@/lib/session";
import { getSupplierUser } from "@/lib/supplier-session";

/**
 * The supplier shell.
 *
 * Outside the `(staff)` route group, so none of the staff chrome exists here:
 * no sidebar, no bottom bar, no global search, no link to anything internal.
 * The navigation is built in this file rather than read from
 * src/config/navigation.ts, because that file is the staff menu and the two
 * must never be able to drift into each other.
 *
 * A staff session reaching this layout is answered with a plain notice rather
 * than an error: the staff cookie is scoped to `/`, so it does arrive here,
 * and bouncing it to a login it is already signed in to would be a loop.
 */
export default async function SupplierLayout({ children }: { children: React.ReactNode }) {
  const staff = await getSessionUser();
  if (staff) return <StaffSessionNotice />;

  const supplier = await getSupplierUser();

  return (
    <>
      <a
        href="#innehall"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-xl focus:bg-primary focus:px-4 focus:py-3 focus:text-on-primary"
      >
        Hoppa till innehållet
      </a>

      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2">
          <Link href="/supplier" className="flex min-h-11 items-center rounded-xl px-1">
            <span className="text-lg font-bold tracking-tight text-ink">Pouch Club</span>
            <span className="ml-2 text-sm text-muted">Leverantör</span>
          </Link>
          {supplier ? (
            <span className="truncate text-sm text-muted">{supplier.brand.name}</span>
          ) : null}
        </div>
      </header>

      <div id="innehall" className="mx-auto max-w-3xl px-0 pb-28">
        {children}
      </div>

      {supplier ? <SupplierNav showStats={salesStatsEnabled()} /> : null}
    </>
  );
}
