import Link from "next/link";
import { notFound } from "next/navigation";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import { formatDateTime, formatNumber, formatSek } from "@/lib/format";
import { getOrder } from "@/lib/repositories/orders";
import { canOrderForStore, requireOrderingUser } from "@/lib/session";
import { countOf, termFor } from "@/lib/terms";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Beställning — Pouch Club",
};

/**
 * One order.
 *
 * The confirmation screen offered "Tidigare beställningar" and nothing that
 * showed the order just placed — the audit recorded that as a dead end. This
 * is what "Se beställningen" opens.
 */
export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireOrderingUser(`/orders/${id}`);

  const order = await getOrder(id);
  if (!order) notFound();

  // Another store's order is a 404, not a redirect: there is nothing for this
  // account at that URL.
  if (!(await canOrderForStore(user, order.store.id))) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <PageHeader
        title={order.store.name}
        description={`Skickad ${formatDateTime(order.submittedAt)}`}
        breadcrumb={{ href: "/orders", label: "Tidigare beställningar" }}
        action={
          <a
            href={`/api/orders/${order.id}/export`}
            className="inline-flex min-h-tap items-center rounded-2xl bg-primary px-5 font-semibold text-on-primary"
          >
            Exportera Excel
          </a>
        }
      />

      <Card className="mb-3">
        <p className="text-base font-semibold tabular-nums">
          {countOf("stock", order.totalQuantity)}
        </p>
        <p className="text-sm text-muted tabular-nums">
          {formatSek(order.totalSek)} inköpsvärde
        </p>
        {order.note ? (
          <p className="mt-3 rounded-xl bg-raised px-3 py-2 text-sm text-ink">
            {order.note}
          </p>
        ) : null}
      </Card>

      <ul className="space-y-2">
        {order.lines.map((line) => (
          <li key={line.productId}>
            <Card padding="p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {line.brand} {line.flavor}
                  </span>
                  <span className="block truncate text-sm text-muted">
                    {[line.strength, line.format].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-semibold tabular-nums">
                    {formatNumber(line.quantity)}{" "}
                    <span className="font-normal text-muted">
                      {termFor("stock", line.quantity)}
                    </span>
                  </span>
                  <span className="block text-sm text-muted tabular-nums">
                    {formatSek(line.lineTotal)}
                  </span>
                </span>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-sm">
        <Link href="/order" className="underline underline-offset-4">
          Lägg en ny beställning
        </Link>
      </p>
    </main>
  );
}
