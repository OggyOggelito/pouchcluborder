import Link from "next/link";
import { notFound } from "next/navigation";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import { stockholmDateKey } from "@/lib/checklists";
import { applyCopyAction } from "@/lib/schedule-actions";
import { COPY_SKIP_LABELS } from "@/lib/schedule/week";
import {
  addDaysToDate,
  formatDateString,
  formatRange,
  isDateString,
  weekNumberOf,
  weekStartOf,
} from "@/lib/schedule/time";
import { previewCopyDay, previewCopyWeek } from "@/lib/repositories/schedule-week";
import { canActOnStore, canEditSchedule } from "@/lib/roles";
import { requireUser, storesForUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Kopiera schema — Pouch Club" };

/**
 * The preview before a copy.
 *
 * A copy writes a dozen rows at once, so it gets a page of its own and a
 * sentence per row rather than a confirmation dialog that says "är du säker?".
 * Nothing on this page writes anything; the button is the only write, and the
 * plan is recomputed server-side when it is pressed.
 */
export default async function CopySchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string; source?: string; target?: string; scope?: string }>;
}) {
  const user = await requireUser("/store/schedule");
  if (!canEditSchedule(user.role)) notFound();

  const params = await searchParams;
  const stores = await storesForUser(user);
  const store = stores.find((candidate) => candidate.id === params.store) ?? stores[0];
  if (!store) notFound();
  if (!canActOnStore(user.role, user.stores.map((own) => own.id), store.id)) notFound();

  const scope = params.scope === "day" ? "day" : "week";
  const target = isDateString(params.target) ? params.target : stockholmDateKey();
  const source = isDateString(params.source)
    ? params.source
    : scope === "week"
      ? addDaysToDate(target, -7)
      : addDaysToDate(target, -7);

  const plan =
    scope === "week"
      ? await previewCopyWeek({ storeId: store.id, sourceDate: source, targetDate: target })
      : await previewCopyDay({ storeId: store.id, sourceDate: source, targetDate: target });

  const backHref = `/store/schedule?store=${store.id}&date=${target}`;
  const sourceLabel =
    scope === "week"
      ? `vecka ${weekNumberOf(source)}`
      : formatDateString(source);
  const targetLabel =
    scope === "week" ? `vecka ${weekNumberOf(target)}` : formatDateString(target);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <PageHeader
        title={scope === "week" ? "Kopiera en vecka" : "Kopiera en dag"}
        description={`${store.name}: från ${sourceLabel} till ${targetLabel}.`}
        breadcrumb={{ href: backHref, label: "Tillbaka till schemat" }}
      />

      {scope === "week" ? (
        <nav aria-label="Välj vilken vecka som kopieras" className="mb-4 flex flex-wrap gap-2">
          {[1, 2, 3].map((weeks) => {
            const candidate = weekStartOf(addDaysToDate(target, -7 * weeks));
            const selected = weekStartOf(source) === candidate;
            return (
              <Link
                key={weeks}
                href={`/store/schedule/copy?store=${store.id}&target=${target}&source=${candidate}&scope=week`}
                aria-current={selected ? "true" : undefined}
                className={`min-h-tap rounded-full border px-4 text-sm leading-[2.75rem] transition ${
                  selected
                    ? "border-primary bg-raised font-semibold ring-1 ring-primary"
                    : "border-control bg-surface font-medium text-muted"
                }`}
              >
                Vecka {weekNumberOf(candidate)}
              </Link>
            );
          })}
        </nav>
      ) : null}

      {plan.create.length === 0 && plan.skipped.length === 0 ? (
        <EmptyState
          title={`Inget att kopiera från ${sourceLabel}`}
          description="Den veckan har inga pass inlagda."
          action={
            <Link href={backHref} className="inline-flex min-h-tap items-center underline underline-offset-4">
              Tillbaka till schemat
            </Link>
          }
        />
      ) : (
        <>
          <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
            <h2 className="font-semibold tracking-tight">
              {plan.create.length === 1
                ? "1 pass läggs in"
                : `${plan.create.length} pass läggs in`}
            </h2>
            <ul className="mt-2 space-y-1 text-sm">
              {plan.create.map((candidate, index) => (
                <li key={`${candidate.employeeId}-${candidate.date}-${index}`}>
                  <span className="font-medium">{candidate.employeeName}</span>{" "}
                  <span className="capitalize">{formatDateString(candidate.date)}</span>{" "}
                  <span className="tabular-nums">
                    {formatRange(candidate.startsAt, candidate.endsAt)}
                  </span>
                  {candidate.onClosedDay ? (
                    <span className="ml-1 text-warning">
                      <span className="sr-only">Varning:</span>
                      <span aria-hidden>⚠</span> butiken är stängd den dagen
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          {plan.skipped.length > 0 ? (
            <section className="mt-4 rounded-2xl border border-line bg-surface p-4 shadow-sm">
              <h2 className="font-semibold tracking-tight">
                {plan.skipped.length === 1
                  ? "1 rad hoppas över"
                  : `${plan.skipped.length} rader hoppas över`}
              </h2>
              <p className="mt-1 text-sm text-muted">
                En kopiering skriver aldrig över något som redan ligger i schemat.
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {plan.skipped.map((skip, index) => (
                  <li key={`${skip.candidate.employeeId}-${skip.candidate.date}-${index}`}>
                    <span className="font-medium">{skip.candidate.employeeName}</span>{" "}
                    <span className="capitalize">{formatDateString(skip.candidate.date)}</span>{" "}
                    <span className="tabular-nums">
                      {formatRange(skip.candidate.startsAt, skip.candidate.endsAt)}
                    </span>{" "}
                    <span className="text-muted">— {COPY_SKIP_LABELS[skip.reason]}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {plan.create.length > 0 ? (
            <form action={applyCopyAction} className="mt-5">
              <input type="hidden" name="storeId" value={store.id} />
              <input type="hidden" name="sourceDate" value={source} />
              <input type="hidden" name="targetDate" value={target} />
              <input type="hidden" name="scope" value={scope} />
              <button
                type="submit"
                className="min-h-14 w-full rounded-2xl bg-primary px-6 font-semibold text-on-primary transition active:scale-[0.99]"
              >
                Kopiera {plan.create.length === 1 ? "passet" : `de ${plan.create.length} passen`}
              </button>
            </form>
          ) : null}

          <p className="mt-3 text-center">
            <Link href={backHref} className="inline-flex min-h-tap items-center text-sm underline underline-offset-4">
              Avbryt
            </Link>
          </p>
        </>
      )}
    </main>
  );
}
