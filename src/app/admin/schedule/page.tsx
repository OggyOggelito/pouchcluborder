import Link from "next/link";
import ShiftImport from "@/components/ShiftImport";
import { getScheduleProvider } from "@/lib/schedule";
import { countShifts } from "@/lib/repositories/shifts";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminSchedulePage() {
  await requireAdmin();
  const counts = await countShifts();

  // Reading the name, not the data — this page says which backend is live.
  let providerName: string;
  try {
    providerName = getScheduleProvider().name;
  } catch (error) {
    providerName = error instanceof Error ? error.message : "Okänd";
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-6">
      <h1 className="text-xl font-semibold tracking-tight">Schema</h1>
      <p className="mt-1 text-zinc-600">
        {counts.total} pass i databasen, {counts.upcoming} framåt i tiden.
      </p>
      <p className="mt-1 text-sm text-zinc-500">
        Aktiv källa: <span className="font-medium">{providerName}</span> — styrs av{" "}
        <code className="font-mono">SCHEDULE_PROVIDER</code> i <code className="font-mono">.env</code>.
      </p>

      <div className="mt-6">
        <ShiftImport />
      </div>

      <p className="mt-6 text-sm">
        <Link href="/team-schedule" className="underline underline-offset-4">
          Visa teamschemat
        </Link>
      </p>
    </main>
  );
}
