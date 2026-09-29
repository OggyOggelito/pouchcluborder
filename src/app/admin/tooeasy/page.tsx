import Link from "next/link";
import { saveTooEasyMappingAction } from "@/lib/admin-actions";
import { prisma } from "@/lib/db";
import { getScheduleProvider } from "@/lib/schedule";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

const FIELD =
  "h-10 w-full rounded-xl border border-zinc-200 px-3 font-mono text-sm outline-none transition focus:border-zinc-400";

/**
 * Identity mapping between our records and TooEasy's.
 *
 * Entered by hand rather than fetched and matched: TooEasy's employee endpoint
 * also returns personnummer and a protected-identity flag, and there is no
 * reason to pull that here just to guess at a match.
 */
export default async function TooEasyMappingPage() {
  await requireAdmin();

  const [users, stores] = await Promise.all([
    prisma.user.findMany({
      orderBy: { email: "asc" },
      select: { id: true, email: true, name: true, tooEasyEmployeeId: true },
    }),
    prisma.store.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, region: true, tooEasyStoreNumber: true },
    }),
  ]);

  let providerName: string;
  try {
    providerName = getScheduleProvider().name;
  } catch (error) {
    providerName = error instanceof Error ? error.message : "okänd";
  }

  const mappedUsers = users.filter((user) => user.tooEasyEmployeeId).length;
  const mappedStores = stores.filter((store) => store.tooEasyStoreNumber).length;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-6">
      <h1 className="text-xl font-semibold tracking-tight">TooEasy-koppling</h1>
      <p className="mt-1 text-zinc-600">
        {mappedUsers} av {users.length} konton och {mappedStores} av {stores.length} butiker är
        kopplade.
      </p>

      <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium">Läget just nu</p>
        <p className="mt-1">
          Aktiv schemakälla är <strong>{providerName}</strong>. API-integrationen är byggd men
          avstängd tills det är bekräftat om{" "}
          <code className="font-mono">tooeasyDemoNew</code> är demo- eller produktionsmiljö. Se
          README.
        </p>
      </div>

      <form action={saveTooEasyMappingAction} className="mt-6 space-y-8">
        <section>
          <h2 className="text-lg font-semibold tracking-tight">Medarbetare</h2>
          <p className="mt-1 text-sm text-zinc-500">
            TooEasys <code className="font-mono">EmployeeId</code> — deras textidentitet, inte
            radnumret. Lämna tomt för att ta bort kopplingen.
          </p>
          <ul className="mt-3 space-y-2">
            {users.map((user) => (
              <li
                key={user.id}
                className="grid gap-2 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm sm:grid-cols-[1fr_200px] sm:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{user.name ?? user.email}</p>
                  <p className="truncate text-sm text-zinc-500">{user.email}</p>
                </div>
                <input
                  name={`user:${user.id}`}
                  defaultValue={user.tooEasyEmployeeId ?? ""}
                  placeholder="EmployeeId"
                  aria-label={`TooEasy EmployeeId för ${user.email}`}
                  className={FIELD}
                />
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight">Butiker</h2>
          <p className="mt-1 text-sm text-zinc-500">
            TooEasys <code className="font-mono">StoreNumber</code>. Pass från en okopplad butik
            hoppas över i stället för att gissas.
          </p>
          <ul className="mt-3 space-y-2">
            {stores.map((store) => (
              <li
                key={store.id}
                className="grid gap-2 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm sm:grid-cols-[1fr_200px] sm:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{store.name}</p>
                  <p className="truncate text-sm text-zinc-500">{store.region ?? "Ingen region"}</p>
                </div>
                <input
                  name={`store:${store.id}`}
                  defaultValue={store.tooEasyStoreNumber ?? ""}
                  placeholder="StoreNumber"
                  aria-label={`TooEasy StoreNumber för ${store.name}`}
                  className={FIELD}
                />
              </li>
            ))}
          </ul>
        </section>

        <button
          type="submit"
          className="h-12 w-full rounded-2xl bg-zinc-900 px-6 font-semibold text-white transition active:scale-[0.99]"
        >
          Spara kopplingar
        </button>
      </form>

      <p className="mt-6 text-sm">
        <Link href="/admin/schedule" className="underline underline-offset-4">
          Till schemaimporten
        </Link>
      </p>
    </main>
  );
}
