import Link from "next/link";
import { saveTooEasyMappingAction } from "@/lib/admin-actions";
import { prisma } from "@/lib/db";
import { getScheduleProvider } from "@/lib/schedule";
import {
  describeEnvironment,
  missingTooEasyConfig,
  readTooEasyConfig,
} from "@/lib/schedule/tooeasy-provider";
import { fetchTooEasyEmployees, type EmployeeDirectory } from "@/lib/schedule/tooeasy-employees";
import { suggestMatch } from "@/lib/schedule/tooeasy-mapper";
import { getScheduleStatus } from "@/lib/schedule/status";
import { formatDateTime } from "@/lib/format";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

const SELECT =
  "h-10 w-full rounded-xl border border-zinc-200 bg-white px-2 text-sm outline-none transition focus:border-zinc-400";

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

  const config = readTooEasyConfig();
  const missing = missingTooEasyConfig(config);
  const configured = missing.length === 0;
  const environment = describeEnvironment(config.baseUrl);
  const status = getScheduleStatus();

  let providerName: string;
  try {
    providerName = getScheduleProvider().name;
  } catch (error) {
    providerName = error instanceof Error ? error.message : "okänd";
  }

  // The directory is only fetched when credentials exist; without them the
  // page still works for manual entry.
  let directory: EmployeeDirectory | null = null;
  let directoryError: string | null = null;
  if (configured) {
    try {
      directory = await fetchTooEasyEmployees();
    } catch (error) {
      directoryError = error instanceof Error ? error.message : "Kunde inte hämta listan.";
    }
  }

  const knownIds = new Set(directory?.options.map((option) => option.employeeId) ?? []);
  const mappedIds = new Set(
    users.map((user) => user.tooEasyEmployeeId).filter(Boolean) as string[]
  );

  // A mapping pointing at someone the API no longer lists — e.g. a leaver.
  const staleUsers = directory
    ? users.filter((user) => user.tooEasyEmployeeId && !knownIds.has(user.tooEasyEmployeeId))
    : [];
  const unmappedTooEasy = (directory?.options ?? []).filter(
    (option) => !mappedIds.has(option.employeeId)
  );

  const mappedUsers = users.filter((user) => user.tooEasyEmployeeId).length;
  const mappedStores = stores.filter((store) => store.tooEasyStoreNumber).length;

  return (
    <main className="mx-auto max-w-4xl px-4 pb-20 pt-6">
      <h1 className="text-xl font-semibold tracking-tight">TooEasy-koppling</h1>

      {/* ---- status panel ---- */}
      <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Status</h2>
        <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <Row label="Aktiv källa" value={providerName} />
          <Row
            label="Uppgifter konfigurerade"
            value={configured ? "Ja" : `Nej — saknar ${missing.join(", ")}`}
            tone={configured ? "ok" : "warn"}
          />
          <Row
            label="Miljö"
            value={
              environment === "unknown"
                ? "Okänd (ingen bas-URL)"
                : environment === "demo"
                  ? "DEMO (enligt URL:en)"
                  : "Produktion (enligt URL:en)"
            }
            tone={environment === "demo" ? "warn" : undefined}
          />
          <Row
            label="Senast lyckad hämtning"
            value={
              status.lastSuccessAt
                ? `${formatDateTime(new Date(status.lastSuccessAt))} (${status.lastFetchCount} pass)`
                : "Aldrig"
            }
          />
          <Row
            label="Senaste fel"
            value={
              status.lastErrorAt
                ? `${formatDateTime(new Date(status.lastErrorAt))} — ${status.lastErrorMessage}`
                : "Inga"
            }
            tone={status.lastErrorAt ? "warn" : undefined}
          />
          <Row label="Kopplingar" value={`${mappedUsers}/${users.length} konton, ${mappedStores}/${stores.length} butiker`} />
        </dl>
        <p className="mt-3 text-xs text-zinc-400">
          Statusen gäller den här serverprocessen och nollställs vid omstart. Inga hemligheter
          eller personuppgifter lagras här.
        </p>
      </section>

      {environment === "demo" ? (
        <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">URL:en pekar på en demomiljö</p>
          <p className="mt-1">
            Bekräfta med TooEasy om den speglar produktion innan schemat används skarpt.
          </p>
        </div>
      ) : null}

      {directoryError ? (
        <div role="alert" className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-900">
          <p className="font-medium">Medarbetarlistan kunde inte hämtas</p>
          <p className="mt-1 font-mono text-xs">{directoryError}</p>
          <p className="mt-1">Du kan fortfarande koppla för hand nedan.</p>
        </div>
      ) : null}

      {directory && directory.protectedCount > 0 ? (
        <div className="mt-4 rounded-2xl bg-zinc-100 p-4 text-sm text-zinc-700">
          <p>
            <strong>{directory.protectedCount}</strong> medarbetare med skyddad identitet visas
            inte i listan. De måste kopplas för hand av en administratör som känner till deras
            anställningsnummer.
          </p>
        </div>
      ) : null}

      {staleUsers.length > 0 ? (
        <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Kopplingar som inte längre finns i TooEasy</p>
          <ul className="mt-1 list-disc pl-5">
            {staleUsers.map((user) => (
              <li key={user.id}>
                {user.name ?? user.email} → <code className="font-mono">{user.tooEasyEmployeeId}</code>
              </li>
            ))}
          </ul>
          <p className="mt-1">Personen kan ha slutat. Ta bort kopplingen eller välj en ny.</p>
        </div>
      ) : null}

      <form action={saveTooEasyMappingAction} className="mt-6 space-y-8">
        <section>
          <h2 className="text-lg font-semibold tracking-tight">Medarbetare</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {directory
              ? "Välj motsvarande person i TooEasy. Förslag är bara en gissning — inget sparas förrän du klickar Spara."
              : "Skriv TooEasys EmployeeId för hand. Tomt fält tar bort kopplingen."}
          </p>

          <ul className="mt-3 space-y-2">
            {users.map((user) => {
              const suggestion = directory ? suggestMatch(user.name, directory.options) : null;
              const current = user.tooEasyEmployeeId ?? "";
              return (
                <li
                  key={user.id}
                  className="grid gap-2 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm sm:grid-cols-[1fr_260px] sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {user.name ?? user.email}
                      {!current ? (
                        <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Okopplad
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-sm text-zinc-500">{user.email}</p>
                    {suggestion && !current ? (
                      <p className="mt-0.5 text-xs text-zinc-500">
                        Förslag: <strong>{suggestion.displayName}</strong> (
                        <code className="font-mono">{suggestion.employeeId}</code>) — välj i listan
                        och spara för att bekräfta.
                      </p>
                    ) : null}
                  </div>

                  {directory ? (
                    <select
                      name={`user:${user.id}`}
                      defaultValue={current}
                      aria-label={`TooEasy-medarbetare för ${user.email}`}
                      className={SELECT}
                    >
                      <option value="">— ingen koppling —</option>
                      {current && !knownIds.has(current) ? (
                        <option value={current}>{current} (finns inte i TooEasy)</option>
                      ) : null}
                      {directory.options.map((option) => (
                        <option key={option.employeeId} value={option.employeeId}>
                          {option.displayName} · {option.employeeId}
                          {option.inactive ? " (inaktiv)" : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      name={`user:${user.id}`}
                      defaultValue={current}
                      placeholder="EmployeeId"
                      aria-label={`TooEasy EmployeeId för ${user.email}`}
                      className={`${SELECT} font-mono`}
                    />
                  )}
                </li>
              );
            })}
          </ul>

          {directory && unmappedTooEasy.length > 0 ? (
            <details className="mt-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-sm">
              <summary className="cursor-pointer font-medium">
                {unmappedTooEasy.length} medarbetare i TooEasy utan koppling hos oss
              </summary>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                {unmappedTooEasy.map((option) => (
                  <li key={option.employeeId} className="text-zinc-600">
                    {option.displayName}{" "}
                    <code className="font-mono text-xs">{option.employeeId}</code>
                    {option.inactive ? <span className="text-zinc-400"> (inaktiv)</span> : null}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
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
                className="grid gap-2 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm sm:grid-cols-[1fr_260px] sm:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {store.name}
                    {!store.tooEasyStoreNumber ? (
                      <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Okopplad
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-sm text-zinc-500">
                    {store.region ?? "Ingen region"}
                  </p>
                </div>
                <input
                  name={`store:${store.id}`}
                  defaultValue={store.tooEasyStoreNumber ?? ""}
                  placeholder="StoreNumber"
                  aria-label={`TooEasy StoreNumber för ${store.name}`}
                  className={`${SELECT} font-mono`}
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

      <p className="mt-6 flex flex-wrap gap-4 text-sm">
        <Link href="/admin/schedule" className="underline underline-offset-4">
          Schemaimport
        </Link>
        <Link href="/team-schedule" className="underline underline-offset-4">
          Teamschema
        </Link>
      </p>
    </main>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd
        className={`truncate text-sm font-medium ${
          tone === "warn" ? "text-amber-700" : tone === "ok" ? "text-brand-700" : "text-zinc-900"
        }`}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}
