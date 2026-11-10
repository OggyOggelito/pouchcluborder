import Link from "next/link";
import { notFound } from "next/navigation";
import ConfirmButton from "@/components/ui/ConfirmButton";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  createEmployeeAction,
  deactivateEmployeeAction,
  reactivateEmployeeAction,
  updateEmployeeAction,
} from "@/lib/employee-actions";
import { linkableUsers, listEmployees } from "@/lib/repositories/employees";
import { canManageEmployees } from "@/lib/roles";
import { requireUser, storesForUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Anställda — Pouch Club" };

/**
 * The staff list.
 *
 * What is stored about a person is on this page in full: a name, a home store,
 * whether they still work here, whether they have said yes to extra shifts
 * elsewhere, and an optional portal account. There is no field for a phone
 * number, an address, a personnummer or a note about the person, and that is
 * deliberate — a staff list grows those by accident.
 */
export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ sparat?: string; inaktiverad?: string; fel?: string; visa?: string }>;
}) {
  const user = await requireUser("/store/employees");
  if (!canManageEmployees(user.role)) notFound();

  const params = await searchParams;
  const showInactive = params.visa === "inaktiva";

  const stores = await storesForUser(user);
  const storeIds = stores.map((store) => store.id);

  const [employees, accounts] = await Promise.all([
    listEmployees({ storeIds, includeInactive: true }),
    linkableUsers(storeIds),
  ]);

  const active = employees.filter((employee) => employee.active);
  const inactive = employees.filter((employee) => !employee.active);
  const shown = showInactive ? inactive : active;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <PageHeader
        title="Anställda"
        description="Personerna som kan läggas in i schemat. Vi sparar namn, hembutik och om personen vill erbjudas extrapass — inget annat."
        breadcrumb={{ href: "/store/schedule", label: "Teamschema" }}
      />

      {params.sparat ? (
        <p role="status" className="mb-4 rounded-2xl border border-success bg-raised p-3 text-sm text-success">
          <span aria-hidden>✓ </span>Sparat.
        </p>
      ) : null}
      {params.inaktiverad ? (
        <p role="status" className="mb-4 rounded-2xl border border-success bg-raised p-3 text-sm text-success">
          <span aria-hidden>✓ </span>Medarbetaren är inaktiverad. Tidigare pass finns kvar.
        </p>
      ) : null}
      {params.fel === "namn" ? (
        <p role="alert" className="mb-4 rounded-2xl border border-danger bg-raised p-3 text-sm text-danger">
          Namnet kan inte vara tomt.
        </p>
      ) : null}

      <div className="mb-4 flex gap-2">
        <Link
          href="/store/employees"
          aria-current={showInactive ? undefined : "true"}
          className={`min-h-tap flex-1 rounded-full border text-center text-sm leading-[2.75rem] transition ${
            showInactive
              ? "border-control bg-surface font-medium text-muted"
              : "border-primary bg-raised font-semibold ring-1 ring-primary"
          }`}
        >
          Aktiva ({active.length})
        </Link>
        <Link
          href="/store/employees?visa=inaktiva"
          aria-current={showInactive ? "true" : undefined}
          className={`min-h-tap flex-1 rounded-full border text-center text-sm leading-[2.75rem] transition ${
            showInactive
              ? "border-primary bg-raised font-semibold ring-1 ring-primary"
              : "border-control bg-surface font-medium text-muted"
          }`}
        >
          Tidigare ({inactive.length})
        </Link>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          title={showInactive ? "Ingen tidigare medarbetare" : "Inga medarbetare ännu"}
          description={
            showInactive
              ? undefined
              : "Lägg in butikens personal nedanför. Sedan kan du skriva in schemat."
          }
        />
      ) : (
        <ul className="space-y-3">
          {shown.map((employee) => (
            <li key={employee.id} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
              <details>
                <summary className="flex min-h-tap cursor-pointer items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block font-medium">{employee.name}</span>
                    <span className="block text-sm text-muted">
                      {employee.homeStore.name}
                      {employee.account ? ` · ${employee.account.label}` : " · inget konto"}
                    </span>
                  </span>
                  {employee.openToExtraShifts ? (
                    <StatusBadge tone="info">Extrapass ok</StatusBadge>
                  ) : null}
                </summary>

                <form action={updateEmployeeAction} className="mt-4 border-t border-line pt-4">
                  <input type="hidden" name="id" value={employee.id} />

                  <label className="block text-sm">
                    <span className="block font-medium">Namn</span>
                    <input
                      name="name"
                      defaultValue={employee.name}
                      required
                      className="mt-1 min-h-tap w-full rounded-xl border border-control bg-raised px-3"
                    />
                  </label>

                  <label className="mt-3 block text-sm">
                    <span className="block font-medium">Hembutik</span>
                    <select
                      name="homeStoreId"
                      defaultValue={employee.homeStore.id}
                      className="mt-1 min-h-tap w-full rounded-xl border border-control bg-raised px-3"
                    >
                      {stores.map((store) => (
                        <option key={store.id} value={store.id}>
                          {store.name}
                        </option>
                      ))}
                    </select>
                    <span className="mt-1 block text-xs text-muted">
                      Tidigare pass flyttas inte — de visar var arbetet faktiskt skedde.
                    </span>
                  </label>

                  <label className="mt-3 block text-sm">
                    <span className="block font-medium">Kopplat konto</span>
                    <select
                      name="userId"
                      defaultValue={employee.account?.id ?? ""}
                      className="mt-1 min-h-tap w-full rounded-xl border border-control bg-raised px-3"
                    >
                      <option value="">Inget konto</option>
                      {/* The employee's own account first: `linkableUsers`
                          lists only accounts nobody is using yet. */}
                      {employee.account ? (
                        <option value={employee.account.id}>{employee.account.label}</option>
                      ) : null}
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.label}
                        </option>
                      ))}
                    </select>
                    <span className="mt-1 block text-xs text-muted">
                      Bara med ett kopplat konto kan personen se sina egna pass.
                    </span>
                  </label>

                  <label className="mt-3 flex min-h-tap items-start gap-3 py-1 text-sm">
                    <input
                      type="checkbox"
                      name="openToExtraShifts"
                      defaultChecked={employee.openToExtraShifts}
                      className="mt-1 size-5 shrink-0"
                    />
                    <span>
                      <span className="block font-medium">Får erbjudas extrapass</span>
                      <span className="block text-xs text-muted">
                        Visas då för närliggande butiker som ledig den dag hon eller han inte har
                        pass. Fråga personen först — det är hennes eller hans val.
                      </span>
                    </span>
                  </label>

                  <button
                    type="submit"
                    className="mt-4 min-h-tap w-full rounded-2xl bg-primary px-4 font-semibold text-on-primary transition active:scale-[0.99]"
                  >
                    Spara
                  </button>
                </form>

                <form
                  action={employee.active ? deactivateEmployeeAction : reactivateEmployeeAction}
                  className="mt-2"
                >
                  <input type="hidden" name="id" value={employee.id} />
                  {employee.active ? (
                    <ConfirmButton
                      className="min-h-tap w-full rounded-2xl border border-control px-4 text-sm font-medium transition hover:bg-raised"
                      title="Inaktivera medarbetaren?"
                      body="Personen går inte längre att lägga in i schemat. Tidigare pass finns kvar — ingenting raderas."
                      confirmLabel="Inaktivera"
                      tone="neutral"
                    >
                      Inaktivera
                    </ConfirmButton>
                  ) : (
                    <button
                      type="submit"
                      className="min-h-tap w-full rounded-2xl border border-control px-4 text-sm font-medium transition hover:bg-raised"
                    >
                      Aktivera igen
                    </button>
                  )}
                </form>
              </details>
            </li>
          ))}
        </ul>
      )}

      <section className="mt-8 rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <h2 className="font-semibold tracking-tight">Lägg till en medarbetare</h2>

        <form action={createEmployeeAction} className="mt-3">
          <label className="block text-sm">
            <span className="block font-medium">Namn</span>
            <input
              name="name"
              required
              placeholder="Förnamn och efternamn"
              className="mt-1 min-h-tap w-full rounded-xl border border-control bg-raised px-3"
            />
          </label>

          <label className="mt-3 block text-sm">
            <span className="block font-medium">Hembutik</span>
            <select
              name="homeStoreId"
              className="mt-1 min-h-tap w-full rounded-xl border border-control bg-raised px-3"
            >
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </label>

          {accounts.length > 0 ? (
            <label className="mt-3 block text-sm">
              <span className="block font-medium">Koppla ett konto (frivilligt)</span>
              <select
                name="userId"
                defaultValue=""
                className="mt-1 min-h-tap w-full rounded-xl border border-control bg-raised px-3"
              >
                <option value="">Inget konto</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.label}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-muted">
                Bara då kan personen se sina egna pass under Mitt schema.
              </span>
            </label>
          ) : null}

          {/* min-h-tap on the label, not the box: the whole row is the target,
              and this hint is short enough that the row would otherwise come
              out at 36px. */}
          <label className="mt-3 flex min-h-tap items-start gap-3 py-1 text-sm">
            <input type="checkbox" name="openToExtraShifts" className="mt-1 size-5 shrink-0" />
            <span>
              <span className="block font-medium">Får erbjudas extrapass</span>
              <span className="block text-xs text-muted">Fråga personen först.</span>
            </span>
          </label>

          <button
            type="submit"
            className="mt-4 min-h-tap w-full rounded-2xl bg-primary px-4 font-semibold text-on-primary transition active:scale-[0.99]"
          >
            Lägg till
          </button>
        </form>
      </section>

      <p className="mt-6 text-xs text-muted">
        Ingenting importeras från TooEasy. Schemat och personallistan skrivs in här.
      </p>
    </main>
  );
}
