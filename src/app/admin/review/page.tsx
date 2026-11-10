import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import { listNeedsReview } from "@/lib/repositories/products";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Granskningskö — Admin",
};

/**
 * The list behind the "N behöver granskas" number.
 *
 * That count has been printed on /admin since the importer shipped with
 * nothing to tap — the audit recorded it as a dead end. Each row shows the raw
 * `Benämning` the importer started from next to what it parsed, which is the
 * only way to judge whether a parse is wrong.
 */
export default async function AdminReviewPage() {
  await requireAdmin();
  const products = await listNeedsReview();

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">
      <PageHeader
        title="Granskningskö"
        description="Produkter som namntolken inte kunde läsa säkert. Jämför med leverantörens ursprungliga benämning."
        breadcrumb={{ href: "/admin", label: "Admin" }}
      />

      {products.length === 0 ? (
        <EmptyState
          title="Inget att granska"
          description="Alla aktiva produkter tolkades säkert vid senaste importen."
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            {products.length === 1 ? "1 produkt" : `${products.length} produkter`} att gå igenom.
            Rätta i leverantörens masterdoc och importera om — den här sidan speglar katalogen.
          </p>

          <ul className="space-y-2">
            {products.map((product) => (
              <li key={product.id}>
                <Card>
                  <p className="font-medium">
                    {product.brand} {product.flavor}
                  </p>
                  <p className="mt-0.5 text-sm text-muted">
                    {[product.strength, product.format].filter(Boolean).join(" · ") || "—"}
                    {product.sku ? ` · ${product.sku}` : ""}
                  </p>

                  {product.reviewNotes ? (
                    <p className="mt-2 rounded-xl bg-raised px-3 py-2 text-sm text-warning">
                      {product.reviewNotes}
                    </p>
                  ) : null}

                  {product.sourceName ? (
                    <p className="mt-2 break-words text-xs text-muted">
                      <span className="font-medium">Leverantörens benämning:</span>{" "}
                      <span className="font-mono">{product.sourceName}</span>
                    </p>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
