import ConfirmButton from "@/components/ui/ConfirmButton";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { CreateSupplierForm, ReissueLinkForm } from "@/components/SupplierAccountForm";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { listSupplierUsers } from "@/lib/repositories/supplier-users";
import { salesStatsEnabled } from "@/lib/sales";
import {
  setStatsPermissionAction,
  setSupplierActiveAction,
} from "@/lib/supplier-admin-actions";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Leverantörskonton — Pouch Club" };

/**
 * Supplier accounts, and who may read their figures.
 *
 * The only screen in the staff portal that knows supplier accounts exist. They
 * are in a table of their own, so no other admin list can show one by mistake
 * — not the user list, not the notification audience, not the employee
 * account picker.
 */
export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ sparat?: string; aktiverad?: string; inaktiverad?: string; fel?: string }>;
}) {
  await requireAdmin();
  const flags = await searchParams;

  const [suppliers, brands, admins] = await Promise.all([
    listSupplierUsers(),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({
      where: { role: "ADMIN" },
      orderBy: { email: "asc" },
      select: { id: true, name: true, email: true, canViewStats: true },
    }),
  ]);

  const active = suppliers.filter((supplier) => supplier.active);
  const inactive = suppliers.filter((supplier) => !supplier.active);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <PageHeader
        title="Leverantörskonton"
        description="Externa inloggningar. Ett konto ser ett varumärke och inget annat."
        breadcrumb={{ href: "/admin", label: "Admin" }}
      />

      {flags.sparat ? (
        <p role="status" className="mb-4 rounded-2xl border border-success bg-raised p-3 text-sm text-success">
          <span aria-hidden="true">✓ </span>Sparat.
        </p>
      ) : null}
      {flags.inaktiverad ? (
        <p role="status" className="mb-4 rounded-2xl border border-success bg-raised p-3 text-sm text-success">
          <span aria-hidden="true">✓ </span>Kontot är avstängt och länkar är ogiltiga.
        </p>
      ) : null}
      {flags.fel === "roll" ? (
        <p role="alert" className="mb-4 rounded-2xl border border-danger bg-raised p-3 text-sm text-danger">
          Statistikbehörigheten kan bara ges till ett administratörskonto.
        </p>
      ) : null}

      {active.length === 0 ? (
        <EmptyState
          title="Inga leverantörskonton"
          description="Skapa ett konto nedanför. Leverantören får en länk och väljer sitt eget lösenord."
        />
      ) : (
        <ul className="space-y-3">
          {active.map((supplier) => (
            <li key={supplier.id} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block font-medium">{supplier.email}</span>
                  <span className="block text-sm text-muted">
                    {supplier.brand.name}
                    {supplier.name ? ` · ${supplier.name}` : ""}
                  </span>
                  <span className="block text-xs text-muted">
                    {supplier.lastLoginAt
                      ? `Senast inloggad ${formatDateTime(supplier.lastLoginAt)}`
                      : "Har aldrig loggat in"}
                  </span>
                </span>
                {supplier.invitePending ? (
                  <StatusBadge tone="info">Väntar på aktivering</StatusBadge>
                ) : supplier.hasPassword ? (
                  <StatusBadge tone="success">Aktivt</StatusBadge>
                ) : (
                  <StatusBadge tone="warning">Inget lösenord</StatusBadge>
                )}
              </div>

              <ReissueLinkForm
                id={supplier.id}
                kind={supplier.hasPassword ? "RESET" : "INVITE"}
              />

              <form action={setSupplierActiveAction} className="mt-2">
                <input type="hidden" name="id" value={supplier.id} />
                <input type="hidden" name="active" value="0" />
                <ConfirmButton
                  className="min-h-tap w-full rounded-2xl border border-control px-4 text-sm font-medium transition hover:bg-raised"
                  title="Stäng av kontot?"
                  body="Leverantören kan inte logga in och utestående länkar slutar gälla. Bokningar och historik finns kvar."
                  confirmLabel="Stäng av"
                  tone="neutral"
                >
                  Stäng av kontot
                </ConfirmButton>
              </form>
            </li>
          ))}
        </ul>
      )}

      {inactive.length > 0 ? (
        <details className="mt-6 rounded-2xl border border-line bg-surface p-4">
          <summary className="min-h-tap cursor-pointer font-medium">
            Avstängda ({inactive.length})
          </summary>
          <ul className="mt-3 space-y-3">
            {inactive.map((supplier) => (
              <li key={supplier.id} className="border-t border-line pt-3 first:border-t-0 first:pt-0">
                <span className="block text-sm font-medium">{supplier.email}</span>
                <span className="block text-xs text-muted">{supplier.brand.name}</span>
                <form action={setSupplierActiveAction} className="mt-2">
                  <input type="hidden" name="id" value={supplier.id} />
                  <input type="hidden" name="active" value="1" />
                  <button
                    type="submit"
                    className="min-h-tap w-full rounded-2xl border border-control px-4 text-sm font-medium transition hover:bg-raised"
                  >
                    Aktivera igen
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="mt-8">
        <CreateSupplierForm brands={brands} />
      </div>

      <section className="mt-8 rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <h2 className="font-semibold tracking-tight">Vem får se statistiken</h2>
        <p className="mt-1 text-sm text-muted">
          Försäljningssiffror är leverantörernas affärsdata. Behörigheten ligger per konto ovanpå
          administratörsrollen och är avstängd som standard.
          {salesStatsEnabled() ? "" : " Statistikmodulen är avstängd just nu."}
        </p>

        <ul className="mt-3 space-y-2">
          {admins.map((admin) => (
            <li
              key={admin.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-raised px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate">{admin.name ?? admin.email}</span>
              <form action={setStatsPermissionAction} className="shrink-0">
                <input type="hidden" name="userId" value={admin.id} />
                <input type="hidden" name="canViewStats" value={admin.canViewStats ? "0" : "1"} />
                <button
                  type="submit"
                  className={`min-h-tap rounded-xl border px-3 text-sm font-medium transition ${
                    admin.canViewStats
                      ? "border-primary bg-surface ring-1 ring-primary"
                      : "border-control bg-surface text-muted"
                  }`}
                >
                  {admin.canViewStats ? "Har tillgång" : "Ge tillgång"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
