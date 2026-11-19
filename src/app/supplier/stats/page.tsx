import { notFound } from "next/navigation";
import PeriodControls from "@/components/sales/PeriodControls";
import SalesView from "@/components/sales/SalesView";
import { stockholmDateKey } from "@/lib/checklists";
import { getBrandSales } from "@/lib/repositories/sales";
import { salesStatsEnabled } from "@/lib/sales";
import { toGranularity } from "@/lib/sales/aggregate";
import { rangeFor, toPeriod } from "@/lib/sales-periods";
import { requireSupplier } from "@/lib/supplier-session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Statistik — Pouch Club" };

/**
 * A supplier's own sales.
 *
 * `getBrandSales` takes a brand id and has no "all brands" branch, and the id
 * comes from the session rather than the query string — so there is no
 * parameter on this page that could widen what it returns.
 *
 * With `SALES_STATS_ENABLED` off the route does not answer at all: half-built
 * statistics in front of a supplier are worse than none.
 */
export default async function SupplierStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; gran?: string; fran?: string; till?: string }>;
}) {
  if (!salesStatsEnabled()) notFound();

  const supplier = await requireSupplier("/supplier/stats");
  const params = await searchParams;

  const period = toPeriod(params.period);
  const granularity = toGranularity(params.gran);
  const range = rangeFor({
    period,
    today: stockholmDateKey(),
    from: params.fran,
    to: params.till,
  });

  const rows = await getBrandSales({
    brandId: supplier.brand.id,
    from: range.from,
    to: range.to,
  });

  const exportParams = new URLSearchParams({
    period,
    gran: granularity,
    fran: range.from,
    till: range.to,
  });

  return (
    <main className="px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Statistik</h1>
      <p className="mt-1 text-muted">
        {supplier.brand.name} — sålda produkter i Pouch Clubs butiker.
      </p>

      <SalesView
        rows={rows}
        granularity={granularity}
        exportHref={`/supplier/stats/export?${exportParams.toString()}`}
        controls={
          <PeriodControls
            basePath="/supplier/stats"
            period={period}
            granularity={granularity}
            from={range.from}
            to={range.to}
          />
        }
      />

      <p className="mt-10 text-xs text-muted">
        Siffrorna är dagliga summor per butik och produkt. De uppdateras när Pouch Club läser in
        försäljningen och kan släpa någon dag.
      </p>
    </main>
  );
}
