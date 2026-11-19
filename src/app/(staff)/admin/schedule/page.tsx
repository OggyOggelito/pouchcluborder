import Link from "next/link";
import ShiftImport from "@/components/ShiftImport";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { getScheduleProvider, scheduleIsStoreEntered, tooEasyIsActive } from "@/lib/schedule";
import { countShifts } from "@/lib/repositories/shifts";
import { countEmployees } from "@/lib/repositories/employees";
import {
  bufferMinutes,
  countShiftsForStores,
} from "@/lib/repositories/schedule-week";
import { listNearbyPairs } from "@/lib/repositories/nearby";
import { storeIdsWithoutHours } from "@/lib/repositories/opening-hours";
import { listStores } from "@/lib/repositories/stores";
import { nearbyIsFromRegion } from "@/lib/schedule/availability";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Schema — Pouch Club" };

/**
 * The schedule, from an admin's side.
 *
 * Says which backend is live, what is still missing before a store can be
 * scheduled, and keeps the old CSV/ICS upload reachable without inviting it:
 * importing into a table nothing reads is a trap, so that section only appears
 * when the import provider is actually the live one.
 */
export default async function AdminSchedulePage() {
  await requireAdmin();

  const stores = await listStores();
  const storeIds = stores.map((store) => store.id);

  const [importedShifts, enteredShifts, employees, withoutHours, pairs] = await Promise.all([
    countShifts(),
    countShiftsForStores(storeIds),
    countEmployees(storeIds),
    storeIdsWithoutHours(),
    listNearbyPairs(),
  ]);

  let providerName: string;
  try {
    providerName = getScheduleProvider().name;
  } catch (error) {
    providerName = error instanceof Error ? error.message : "Okänd";
  }

  const missingHours = stores.filter((store) => withoutHours.includes(store.id));

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-6">
      <PageHeader
        title="Schema"
        description="Butikerna skriver in sitt eget schema. Inget hämtas från TooEasy."
        breadcrumb={{ href: "/admin", label: "Admin" }}
      />

      <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold tracking-tight">Aktiv källa</p>
            <p className="mt-0.5 text-sm text-muted">{providerName}</p>
            <p className="mt-2 text-sm text-muted">
              Styrs av <code className="font-mono">SCHEDULE_PROVIDER</code> i{" "}
              <code className="font-mono">.env</code>:{" "}
              <code className="font-mono">manual</code> (butikernas eget schema),{" "}
              <code className="font-mono">import</code> (CSV/ICS-uppladdning) eller{" "}
              <code className="font-mono">tooeasy</code> (API, vilande).
            </p>
          </div>
          <StatusBadge tone={scheduleIsStoreEntered() ? "success" : "warning"}>
            {scheduleIsStoreEntered() ? "Butikernas schema" : "Annan källa"}
          </StatusBadge>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          ["Inlagda pass", String(enteredShifts)],
          [
            "Aktiva medarbetare",
            `${employees.active}${employees.openToExtra > 0 ? ` (${employees.openToExtra} för extrapass)` : ""}`,
          ],
          ["Marginal kring öppettider", `${bufferMinutes()} min`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-line bg-surface p-4">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="mt-1 font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      {missingHours.length > 0 ? (
        <p className="mt-4 rounded-2xl border border-warning bg-raised p-4 text-sm text-warning">
          <span className="sr-only">Varning:</span>
          <span aria-hidden>⚠ </span>
          {missingHours.length === 1
            ? `${missingHours[0].name} har inga öppettider inlagda.`
            : `${missingHours.length} butiker saknar öppettider: ${missingHours.map((store) => store.name).join(", ")}.`}{" "}
          Utan dem visar schemat varken mallar eller luckor.
        </p>
      ) : null}

      <section className="mt-6">
        <h2 className="text-lg font-semibold tracking-tight">Öppettider per butik</h2>
        <ul className="mt-3 space-y-2">
          {stores.map((store) => (
            <li key={store.id}>
              <Card href={`/admin/stores/${store.id}/hours`}>
                <span className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block font-medium">{store.name}</span>
                    <span className="block text-sm text-muted">
                      {withoutHours.includes(store.id)
                        ? "Inga öppettider inlagda"
                        : "Öppettider och röda dagar"}
                    </span>
                  </span>
                  <span aria-hidden className="text-muted">
                    ›
                  </span>
                </span>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Card href="/admin/nearby">
          <span className="block font-semibold tracking-tight">Närliggande butiker</span>
          <span className="mt-1 block text-sm text-muted">
            {nearbyIsFromRegion(pairs)
              ? "Inga par inlagda — region gäller."
              : `${pairs.length / 2} par inlagda.`}
          </span>
        </Card>
        <Card href="/store/employees">
          <span className="block font-semibold tracking-tight">Anställda</span>
          <span className="mt-1 block text-sm text-muted">
            Namn, hembutik och vem som får erbjudas extrapass.
          </span>
        </Card>
      </div>

      {tooEasyIsActive() ? (
        <p className="mt-6 text-sm">
          <Link href="/admin/tooeasy" className="underline underline-offset-4">
            TooEasy-kopplingens status
          </Link>
        </p>
      ) : null}

      <details className="mt-8 rounded-2xl border border-line bg-surface p-4">
        <summary className="min-h-tap cursor-pointer font-medium">
          Gamla importvägen (CSV/ICS)
        </summary>
        <p className="mt-2 text-sm text-muted">
          Behålls men används inte. Den läser in i en egen tabell som bara{" "}
          <code className="font-mono">SCHEDULE_PROVIDER=import</code> visar — just nu ligger{" "}
          {importedShifts.total} importerade pass där, och de syns inte i appen. Vill du använda
          den igen, byt värdet i <code className="font-mono">.env</code> först.
        </p>

        {providerName.includes("Manuell import") ? (
          <div className="mt-4">
            <ShiftImport />
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">
            Uppladdningen visas bara när importvägen är den aktiva källan — annars vore den en
            fälla.
          </p>
        )}
      </details>
    </main>
  );
}
