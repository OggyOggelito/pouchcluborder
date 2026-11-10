import Link from "next/link";
import CsvImport from "@/components/CsvImport";
import SupplierImport from "@/components/SupplierImport";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import { adminSections } from "@/config/navigation";
import { countFor, getAdminCounts } from "@/lib/repositories/admin-counts";
import { countProducts } from "@/lib/repositories/products";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin — Pouch Club",
};

/**
 * The admin hub: cards grouped by the job they belong to, each carrying its
 * own "behöver åtgärd" count.
 *
 * Imports live at the bottom rather than the top. They are the rarest thing an
 * admin does and used to be the first thing on the page.
 */
export default async function AdminPage() {
  await requireAdmin();

  const [counts, products] = await Promise.all([getAdminCounts(), countProducts()]);
  const sections = adminSections();
  const outstanding =
    counts.openIssues + counts.newRequests + counts.openTransfers + counts.needsReview;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">
      <PageHeader
        title="Admin"
        description={
          outstanding === 0
            ? `${products.active} aktiva produkter. Inget väntar på åtgärd.`
            : `${products.active} aktiva produkter. ${outstanding} poster behöver åtgärd.`
        }
      />

      {sections.map((section) => (
        <section key={section.section} className="mb-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            {section.label}
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {section.entries.map((entry) => {
              const count = countFor(entry, counts);
              return (
                <li key={entry.href}>
                  <Card href={entry.href} className="h-full">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block font-semibold tracking-tight">{entry.label}</span>
                        <span className="block text-sm text-muted">{entry.description}</span>
                      </span>
                      {count !== null && count > 0 ? (
                        <span className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-on-primary">
                          {count}
                          <span className="sr-only"> behöver åtgärd</span>
                        </span>
                      ) : null}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <section className="mt-8 border-t border-line pt-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          Importera katalog
        </h2>
        <SupplierImport />
        <CsvImport />
      </section>

      <p className="mt-8 text-sm text-muted">
        <Link href="/order" className="underline underline-offset-4">
          Till beställningen
        </Link>
      </p>
    </main>
  );
}
