import Link from "next/link";
import IssueCard from "@/components/IssueCard";
import { countOpenIssues, listIssuesForStores } from "@/lib/repositories/issues";
import { listStores } from "@/lib/repositories/stores";
import { canAccessAllStores } from "@/lib/roles";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Problemrapporter — Pouch Club",
};

/** The store's own reports. Anyone with access to the store may read and file. */
export default async function StoreIssuesPage() {
  const user = await requireUser("/store/issues");

  const stores = canAccessAllStores(user.role) ? await listStores() : user.stores;

  if (stores.length === 0) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-xl font-semibold tracking-tight">Problemrapporter</h1>
        <p className="mt-2 text-zinc-600">
          Ditt konto är inte kopplat till någon butik. Be en administratör koppla en.
        </p>
      </main>
    );
  }

  const storeIds = stores.map((store) => store.id);
  const [issues, open] = await Promise.all([
    listIssuesForStores({ storeIds }),
    countOpenIssues(storeIds),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-20 pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Problemrapporter</h1>
        <Link href="/store/notes" className="text-sm font-medium underline underline-offset-4">
          Skiftanteckningar
        </Link>
      </div>
      <p className="mt-1 text-sm text-zinc-500">
        Skadad vara, fel etikett, trasig utrustning eller en leverans som strulat.
        {open === 0
          ? " Inget öppet just nu."
          : open === 1
            ? " En är öppen just nu."
            : ` ${open} är öppna just nu.`}
      </p>

      <Link
        href="/store/issues/new"
        className="mt-4 flex h-14 items-center justify-center rounded-2xl bg-zinc-900 px-6 text-lg font-semibold text-white transition active:scale-[0.99]"
      >
        Skapa problemrapport
      </Link>

      {issues.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-zinc-500">
          Inga rapporter än.
        </p>
      ) : (
        <ul className="mt-5 space-y-2">
          {issues.map((issue) => (
            <li key={issue.id}>
              <IssueCard issue={issue} href={`/store/issues/${issue.id}`} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
