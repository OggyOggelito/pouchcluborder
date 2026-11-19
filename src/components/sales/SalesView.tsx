import Link from "next/link";
import TrendChart from "@/components/sales/TrendChart";
import EmptyState from "@/components/ui/EmptyState";
import { formatNumber, formatSek } from "@/lib/format";
import {
  GRANULARITY_LABELS,
  byProduct,
  byStore,
  overTime,
  totals,
  type Granularity,
  type SalesRow,
} from "@/lib/sales/aggregate";

/**
 * One brand's figures.
 *
 * The same component serves the supplier's own page and the admin's
 * "se som leverantör" preview, so the two cannot drift: whatever an admin
 * checks is literally what the supplier sees.
 *
 * What is deliberately absent, and must stay absent: any other brand's
 * numbers, any ranking against other brands, a share of total sales, and our
 * purchase prices or margins. A share would reveal competitors' figures by
 * arithmetic, which is the same leak taking a longer route.
 */
export default function SalesView({
  rows,
  granularity,
  exportHref,
  controls,
}: {
  rows: SalesRow[];
  granularity: Granularity;
  exportHref?: string;
  controls?: React.ReactNode;
}) {
  const summary = totals(rows);
  const trend = overTime(rows, granularity);
  const products = byProduct(rows);
  const stores = byStore(rows);

  return (
    <>
      {controls}

      {rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Ingen försäljning i perioden"
            description="Välj ett annat datumintervall, eller kom tillbaka när siffrorna för dagen har lästs in."
          />
        </div>
      ) : (
        <>
          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Figure label="Sålda" value={formatNumber(summary.quantity)} />
            <Figure
              label="Försäljning"
              value={summary.amount === null ? "—" : formatSek(summary.amount)}
              note={
                summary.amount === null
                  ? "Källan rapporterar inga belopp"
                  : summary.amountPartial
                    ? "Vissa rader saknar belopp"
                    : undefined
              }
            />
            <Figure label="Produkter" value={formatNumber(summary.products)} />
            <Figure label="Butiker" value={formatNumber(summary.stores)} />
          </dl>

          <section className="mt-8">
            <h2 className="text-lg font-semibold tracking-tight">
              {GRANULARITY_LABELS[granularity]}
            </h2>
            <TrendChart buckets={trend} />
            <Table
              caption={GRANULARITY_LABELS[granularity]}
              head="Period"
              rows={trend.map((bucket) => ({
                key: bucket.key,
                label: bucket.label,
                quantity: bucket.quantity,
                amount: bucket.amount,
              }))}
            />
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold tracking-tight">Per produkt</h2>
            <Table
              caption="Försäljning per produkt"
              head="Produkt"
              rows={products.map((bucket) => ({
                key: bucket.key,
                label: bucket.label,
                quantity: bucket.quantity,
                amount: bucket.amount,
              }))}
            />
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold tracking-tight">Per butik</h2>
            <Table
              caption="Försäljning per butik"
              head="Butik"
              rows={stores.map((bucket) => ({
                key: bucket.key,
                label: bucket.label,
                quantity: bucket.quantity,
                amount: bucket.amount,
              }))}
            />
          </section>

          {exportHref ? (
            <p className="mt-8">
              <Link
                href={exportHref}
                prefetch={false}
                className="inline-flex min-h-tap items-center rounded-2xl border border-control px-5 text-sm font-medium transition hover:bg-raised"
              >
                Exportera till Excel
              </Link>
            </p>
          ) : null}
        </>
      )}
    </>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>
      {note ? <dd className="mt-0.5 text-xs text-muted">{note}</dd> : null}
    </div>
  );
}

function Table({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: string;
  rows: { key: string; label: string; quantity: number; amount: number | null }[];
}) {
  return (
    <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="px-3 py-2 text-left font-semibold">
              {head}
            </th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">
              Sålda
            </th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">
              Försäljning
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-line last:border-b-0">
              <td className="px-3 py-2">{row.label}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatNumber(row.quantity)}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {row.amount === null ? "—" : formatSek(row.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
