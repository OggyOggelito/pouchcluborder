import { Suspense } from "react";
import DemoDayBooker from "@/components/supplier/DemoDayBooker";
import { stockholmDateKey } from "@/lib/checklists";
import { bookableRange, MIN_LEAD_DAYS, MAX_AHEAD_DAYS } from "@/lib/demo-days";
import { isDateString } from "@/lib/schedule/time";
import { storeOptionsForDate } from "@/lib/repositories/demo-days";
import { requireSupplier } from "@/lib/supplier-session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Boka demodag — Pouch Club" };

export default async function BookDemoDayPage({
  searchParams,
}: {
  searchParams: Promise<{ datum?: string }>;
}) {
  await requireSupplier("/supplier/boka");

  const today = stockholmDateKey();
  const range = bookableRange(today);
  const { datum } = await searchParams;

  // A date outside the bookable window falls back to the earliest one rather
  // than rendering a list the form would then refuse.
  const date =
    isDateString(datum) && datum >= range.from && datum <= range.to ? datum : range.from;

  const options = await storeOptionsForDate(date);

  return (
    <main className="px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Boka demodag</h1>
      <p className="mt-1 text-muted">
        Välj en dag och de butiker du vill besöka. Tidigast {MIN_LEAD_DAYS} dagar fram, senast{" "}
        {MAX_AHEAD_DAYS} dagar fram.
      </p>

      <Suspense fallback={<p className="mt-6 text-muted">Laddar…</p>}>
        <DemoDayBooker date={date} options={options} min={range.from} max={range.to} />
      </Suspense>
    </main>
  );
}
