import Link from "next/link";
import ConfirmButton from "@/components/ui/ConfirmButton";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { linkStoresAction, unlinkStoresAction } from "@/lib/nearby-actions";
import { listNearbyPairs, nearbyMap } from "@/lib/repositories/nearby";
import { nearbyIsFromRegion } from "@/lib/schedule/availability";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Närliggande butiker — Pouch Club" };

/**
 * Which stores may see each other's free staff.
 *
 * Nothing here is inferred from a map. Two shops in the same mall and two
 * shops four hours apart look identical to this app, so an admin says which
 * pairs count — and until somebody does, stores in the same region do.
 *
 * ADMIN only: it decides who sees whose employees, which is not one store's
 * call to make.
 */
export default async function NearbyPage({
  searchParams,
}: {
  searchParams: Promise<{ sparat?: string; borttagen?: string; fel?: string }>;
}) {
  await requireAdmin();
  const flags = await searchParams;

  const [rows, pairs] = await Promise.all([nearbyMap(), listNearbyPairs()]);
  const fromRegion = nearbyIsFromRegion(pairs);
  const alone = rows.filter((row) => row.nearby.length === 0);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <PageHeader
        title="Närliggande butiker"
        description="Vilka butiker som får se varandras lediga medarbetare."
        breadcrumb={{ href: "/admin", label: "Admin" }}
      />

      {flags.sparat ? (
        <p role="status" className="mb-4 rounded-2xl border border-success bg-raised p-3 text-sm text-success">
          <span aria-hidden>✓ </span>Butikerna är kopplade.
        </p>
      ) : null}
      {flags.borttagen ? (
        <p role="status" className="mb-4 rounded-2xl border border-success bg-raised p-3 text-sm text-success">
          <span aria-hidden>✓ </span>Kopplingen är borttagen.
        </p>
      ) : null}
      {flags.fel === "val" ? (
        <p role="alert" className="mb-4 rounded-2xl border border-danger bg-raised p-3 text-sm text-danger">
          Välj två olika butiker.
        </p>
      ) : null}

      <div
        className={`rounded-2xl border p-4 text-sm ${
          fromRegion ? "border-info bg-raised text-info" : "border-line bg-surface"
        }`}
      >
        {fromRegion ? (
          <>
            <span className="sr-only">Information:</span>
            <span aria-hidden>i </span>
            <span className="font-semibold">Region gäller just nu.</span> Inga par är inlagda, så
            butiker med samma region räknas som närliggande. Så snart du lägger in ett par slutar
            regionen att gälla — för alla butiker.
          </>
        ) : (
          <>
            <span className="font-semibold">Inlagda par gäller.</span> Regionen används inte
            längre. Tar du bort alla par går appen tillbaka till regionen.
          </>
        )}
      </div>

      {alone.length > 0 ? (
        <p className="mt-3 rounded-2xl border border-warning bg-raised p-4 text-sm text-warning">
          <span className="sr-only">Varning:</span>
          <span aria-hidden>⚠ </span>
          {alone.length === 1
            ? `${alone[0].store.name} har ingen närliggande butik och ser därför inga lediga medarbetare.`
            : `${alone.length} butiker har ingen närliggande butik: ${alone
                .map((row) => row.store.name)
                .join(", ")}.`}
        </p>
      ) : null}

      <ul className="mt-5 space-y-2">
        {rows.map((row) => (
          <li key={row.store.id} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="block font-medium">{row.store.name}</span>
                <span className="block text-sm text-muted">
                  {row.store.region ? `Region ${row.store.region}` : "Ingen region"}
                </span>
              </span>
              {row.nearby.length === 0 ? (
                <StatusBadge tone="warning">Ensam</StatusBadge>
              ) : null}
            </div>

            {row.nearby.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {row.nearby.map((neighbour) => (
                  <li
                    key={neighbour.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-raised px-3 py-2 text-sm"
                  >
                    <span>{neighbour.name}</span>
                    {fromRegion ? (
                      <span className="text-xs text-muted">via region</span>
                    ) : (
                      <form action={unlinkStoresAction}>
                        <input type="hidden" name="storeId" value={row.store.id} />
                        <input type="hidden" name="nearbyStoreId" value={neighbour.id} />
                        <ConfirmButton
                          className="min-h-tap rounded-xl border border-control px-3 text-sm font-medium transition hover:bg-surface"
                          title="Ta bort kopplingen?"
                          body={`${row.store.name} och ${neighbour.name} ser inte längre varandras lediga medarbetare.`}
                          confirmLabel="Ta bort"
                          tone="neutral"
                        >
                          Ta bort
                        </ConfirmButton>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>

      <section className="mt-8 rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <h2 className="font-semibold tracking-tight">Koppla två butiker</h2>
        <p className="mt-1 text-sm text-muted">
          Kopplingen gäller båda vägarna. Täby Centrum och Kungsholmen ligger närmast varandra.
        </p>

        <form action={linkStoresAction} className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="block font-medium">Butik</span>
            <select
              name="storeId"
              className="mt-1 min-h-tap w-full rounded-xl border border-control bg-raised px-3"
            >
              {rows.map((row) => (
                <option key={row.store.id} value={row.store.id}>
                  {row.store.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="block font-medium">Närliggande butik</span>
            <select
              name="nearbyStoreId"
              className="mt-1 min-h-tap w-full rounded-xl border border-control bg-raised px-3"
            >
              {rows.map((row) => (
                <option key={row.store.id} value={row.store.id}>
                  {row.store.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="min-h-tap rounded-2xl bg-primary px-4 font-semibold text-on-primary transition active:scale-[0.99] sm:col-span-2"
          >
            Koppla
          </button>
        </form>
      </section>

      <p className="mt-6 text-sm">
        <Link href="/schedule/available" className="underline underline-offset-4">
          Se vad en butik ser
        </Link>
      </p>
    </main>
  );
}
