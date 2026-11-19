import Link from "next/link";
import { notFound } from "next/navigation";
import PeriodControls from "@/components/sales/PeriodControls";
import SalesImportForm from "@/components/sales/SalesImportForm";
import SalesView from "@/components/sales/SalesView";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { prisma } from "@/lib/db";
import { stockholmDateKey } from "@/lib/checklists";
import { formatDateTime } from "@/lib/format";
import {
  countUnmatched,
  getAllSales,
  getBrandSales,
  listImports,
  listUnmatched,
  salesCoverage,
} from "@/lib/repositories/sales";
import { getSalesProvider, salesStatsEnabled } from "@/lib/sales";
import { toGranularity } from "@/lib/sales/aggregate";
import { rangeFor, toPeriod } from "@/lib/sales-periods";
import { resolveUnmatchedAction } from "@/lib/sales-actions";
import { requireStatsUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Statistik — Pouch Club" };

/**
 * The full picture, plus the tools behind it.
 *
 * Two gates: the ADMIN role and the per-account `canViewStats` permission.
 * "Se som leverantör" renders the very same component a supplier gets, so
 * checking what they can see cannot drift from what they do see.
 */
export default async function AdminStatsPage({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string;
    gran?: string;
    fran?: string;
    till?: string;
    varumarke?: string;
    som?: string;
  }>;
}) {
  if (!salesStatsEnabled()) notFound();
  await requireStatsUser();

  const params = await searchParams;
  const period = toPeriod(params.period);
  const granularity = toGranularity(params.gran);
  const range = rangeFor({
    period,
    today: stockholmDateKey(),
    from: params.fran,
    to: params.till,
  });

  const previewBrandId = params.som || null;

  const [brands, rows, coverage, imports, unmatched, unmatchedCount, products] =
    await Promise.all([
      prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      previewBrandId
        ? getBrandSales({ brandId: previewBrandId, from: range.from, to: range.to })
        : getAllSales({ from: range.from, to: range.to, brandId: params.varumarke || null }),
      salesCoverage(),
      listImports(10),
      listUnmatched(50),
      countUnmatched(),
      prisma.product.findMany({
        where: { active: true },
        orderBy: [{ brand: "asc" }, { flavor: "asc" }],
        select: { id: true, brand: true, flavor: true, strength: true, format: true },
        take: 2000,
      }),
    ]);

  const previewBrand = previewBrandId
    ? (brands.find((brand) => brand.id === previewBrandId) ?? null)
    : null;

  let providerName: string;
  try {
    providerName = getSalesProvider().name;
  } catch (error) {
    providerName = error instanceof Error ? error.message : "Okänd";
  }

  const extra: Record<string, string> = {};
  if (previewBrandId) extra.som = previewBrandId;
  else if (params.varumarke) extra.varumarke = params.varumarke;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-6">
      <PageHeader
        title="Statistik"
        description="Försäljning per dag, produkt och butik."
        breadcrumb={{ href: "/admin", label: "Admin" }}
      />

      <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold tracking-tight">Källa</p>
            <p className="mt-0.5 text-sm text-muted">{providerName}</p>
            <p className="mt-2 text-sm text-muted">
              {coverage.rows === 0
                ? "Ingen försäljning inläst ännu."
                : `${coverage.rows} dagsrader, ${coverage.from} – ${coverage.to}.`}
            </p>
          </div>
          {unmatchedCount > 0 ? (
            <StatusBadge tone="warning">{unmatchedCount} omatchade</StatusBadge>
          ) : null}
        </div>
      </div>

      {previewBrand ? (
        <div
          role="status"
          className="mt-4 rounded-2xl border border-info bg-raised p-4 text-sm text-info"
        >
          <span className="sr-only">Information:</span>
          <span aria-hidden="true">i </span>
          <strong>Du ser sidan som {previewBrand.name} ser den.</strong> Exakt samma vy som
          leverantören får — inga andra varumärken, inga priser.{" "}
          <Link href="/admin/stats" className="underline underline-offset-4">
            Tillbaka till helheten
          </Link>
        </div>
      ) : null}

      <SalesView
        rows={rows}
        granularity={granularity}
        controls={
          <>
            <PeriodControls
              basePath="/admin/stats"
              period={period}
              granularity={granularity}
              from={range.from}
              to={range.to}
              extra={extra}
            />
            {!previewBrand ? (
              <form method="get" className="mt-3 flex flex-wrap items-end gap-3">
                <input type="hidden" name="period" value={period} />
                <input type="hidden" name="gran" value={granularity} />
                <input type="hidden" name="fran" value={range.from} />
                <input type="hidden" name="till" value={range.to} />
                <label className="text-sm">
                  <span className="block font-medium">Varumärke</span>
                  <select
                    name="varumarke"
                    defaultValue={params.varumarke ?? ""}
                    className="mt-1 min-h-tap rounded-xl border border-control bg-raised px-3"
                  >
                    <option value="">Alla</option>
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  className="min-h-tap rounded-2xl border border-control px-4 text-sm font-medium transition hover:bg-raised"
                >
                  Visa
                </button>
              </form>
            ) : null}
          </>
        }
      />

      {!previewBrand ? (
        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">Se som leverantör</h2>
          <p className="mt-1 text-sm text-muted">
            Öppnar samma vy som leverantörens egen sida, skrivskyddad.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {brands.map((brand) => (
              <Link
                key={brand.id}
                href={`/admin/stats?som=${brand.id}&period=${period}&gran=${granularity}&fran=${range.from}&till=${range.to}`}
                className="min-h-tap rounded-full border border-control bg-surface px-4 text-sm font-medium leading-[2.75rem] transition hover:border-primary"
              >
                {brand.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-10">
        <SalesImportForm />
      </section>

      {unmatched.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold tracking-tight">
            Rader som inte matchade en produkt
          </h2>
          <p className="mt-1 text-sm text-muted">
            Inget kastas bort. Välj rätt produkt, så läggs raden till i dagens siffror.
          </p>
          <ul className="mt-3 space-y-2">
            {unmatched.map((row) => (
              <li key={row.id} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
                <p className="text-sm">
                  <span className="font-medium">{row.description ?? "(ingen benämning)"}</span>
                  <span className="block text-xs text-muted">
                    {row.date} · {row.storeName ?? "okänd butik"} · {row.quantity} st
                    {row.sku ? ` · art.nr ${row.sku}` : ""}
                    {row.ean ? ` · EAN ${row.ean}` : ""}
                  </span>
                </p>
                <form action={resolveUnmatchedAction} className="mt-2 flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={row.id} />
                  <select
                    name="productId"
                    required
                    defaultValue=""
                    className="min-h-tap min-w-0 flex-1 rounded-xl border border-control bg-raised px-3 text-sm"
                  >
                    <option value="" disabled>
                      Välj produkt
                    </option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.brand} {product.flavor} {product.strength} {product.format}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="min-h-tap rounded-2xl border border-control px-4 text-sm font-medium transition hover:bg-raised"
                  >
                    Koppla
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {imports.length > 0 ? (
        <details className="mt-8 rounded-2xl border border-line bg-surface p-4">
          <summary className="min-h-tap cursor-pointer font-medium">
            Inläsningar ({imports.length})
          </summary>
          <ul className="mt-3 space-y-2 text-sm">
            {imports.map((row) => (
              <li key={row.id} className="border-t border-line pt-2 first:border-t-0 first:pt-0">
                <span className="block">
                  {row.fileName ?? row.source} · {row.fromDate} – {row.toDate}
                </span>
                <span className="block text-xs text-muted">
                  {row.rowsStored} av {row.rowsRead} rader, {row.rowsUnmatched} omatchade ·{" "}
                  {formatDateTime(row.createdAt)}
                  {row.byName ? ` · ${row.byName}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <p className="mt-8 text-xs text-muted">
        Leverantörerna ser bara sitt eget varumärke, aldrig andras siffror, ingen marknadsandel
        och inga inköpspriser.
      </p>
    </main>
  );
}
