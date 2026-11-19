import Link from "next/link";
import { notFound } from "next/navigation";
import ConfirmButton from "@/components/ui/ConfirmButton";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  acceptExtraShiftAction,
  cancelExtraShiftAction,
  declineExtraShiftAction,
} from "@/lib/extra-shift-actions";
import { getRequest } from "@/lib/repositories/extra-shifts";
import {
  DOUBLE_BOOKED_MESSAGE,
  EXTRA_SHIFT_NOTICE,
  EXTRA_SHIFT_STATUS_LABELS,
  isOpenRequest,
  type ExtraShiftStatus,
} from "@/lib/schedule/extra-shifts";
import { formatDateTime } from "@/lib/format";
import { formatLongDateString, formatRange } from "@/lib/schedule/time";
import { canActOnStore, canEditSchedule, canViewAvailability } from "@/lib/roles";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Extrapass — Pouch Club" };

const TONES: Record<ExtraShiftStatus, "info" | "success" | "danger" | "neutral"> = {
  REQUESTED: "info",
  ACCEPTED: "success",
  DECLINED: "danger",
  CANCELLED: "neutral",
};

const EVENT_LABELS: Record<string, string> = {
  CREATED: "Förfrågan skickad",
  ACCEPTED: "Accepterad",
  DECLINED: "Nekad",
  CANCELLED: "Återkallad",
};

/**
 * One request, and whichever button belongs to the person reading it.
 *
 * Who may see it: the two stores involved, and an admin. Who may answer it:
 * the employee's own store. Both are decided here from the account, and the
 * buttons are a consequence of that decision rather than the protection for it
 * — the actions check again.
 */
export default async function ExtraShiftPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ krock?: string; svarat?: string }>;
}) {
  const user = await requireUser("/schedule/extra");
  if (!canViewAvailability(user.role)) notFound();

  const { id } = await params;
  const { krock, svarat } = await searchParams;

  const request = await getRequest(id);
  if (!request) notFound();

  const ownStoreIds = user.stores.map((store) => store.id);
  const isHomeStore = canActOnStore(user.role, ownStoreIds, request.employee.homeStore.id);
  const isAskingStore = canActOnStore(user.role, ownStoreIds, request.requestingStore.id);

  // Not a party to it, and not an admin: there is nothing here for you.
  if (!isHomeStore && !isAskingStore) notFound();

  const mayAnswer = isHomeStore && canEditSchedule(user.role) && isOpenRequest(request.status);
  const mayCancel = isAskingStore && isOpenRequest(request.status);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <PageHeader
        title="Extrapass"
        description={`${request.employee.name} · ${request.employee.homeStore.name}`}
        breadcrumb={{ href: "/schedule/extra", label: "Alla extrapass" }}
      />

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold capitalize tracking-tight">
              {formatLongDateString(request.date)}
            </p>
            <p className="mt-0.5 tabular-nums">
              {formatRange(request.startsAt, request.endsAt)}
            </p>
            <p className="mt-2 text-sm text-muted">
              {request.requestingStore.name} frågar {request.employee.homeStore.name}.
            </p>
          </div>
          <StatusBadge tone={TONES[request.status]}>
            {EXTRA_SHIFT_STATUS_LABELS[request.status]}
          </StatusBadge>
        </div>

        {request.note ? (
          <p className="mt-4 whitespace-pre-line rounded-xl bg-raised p-3 text-sm">
            {request.note}
          </p>
        ) : null}
      </section>

      {krock === "1" ? (
        <p role="alert" className="mt-4 rounded-2xl border border-danger bg-raised p-4 text-sm text-danger">
          <span className="font-semibold">Gick inte att acceptera.</span> {DOUBLE_BOOKED_MESSAGE}
        </p>
      ) : null}

      {svarat ? (
        <p role="alert" className="mt-4 rounded-2xl border border-warning bg-raised p-4 text-sm text-warning">
          <span className="sr-only">Varning:</span>
          <span aria-hidden>⚠ </span>
          Förfrågan var redan{" "}
          {EXTRA_SHIFT_STATUS_LABELS[svarat as ExtraShiftStatus]?.toLowerCase() ?? "besvarad"} när
          du svarade. Sidan visar det som gäller nu.
        </p>
      ) : null}

      {mayAnswer ? (
        <section className="mt-5">
          <p className="text-sm text-muted">{EXTRA_SHIFT_NOTICE}</p>
          <form action={acceptExtraShiftAction} className="mt-3">
            <input type="hidden" name="requestId" value={request.id} />
            <button
              type="submit"
              className="min-h-14 w-full rounded-2xl bg-primary px-6 font-semibold text-on-primary transition active:scale-[0.99]"
            >
              Ja, {request.employee.name} kan jobba
            </button>
          </form>
          <form action={declineExtraShiftAction} className="mt-2">
            <input type="hidden" name="requestId" value={request.id} />
            <ConfirmButton
              className="min-h-tap w-full rounded-2xl border border-control px-4 text-sm font-medium transition hover:bg-raised"
              title="Neka förfrågan?"
              body={`${request.requestingStore.name} får veta att ni inte kan avvara ${request.employee.name}. Ingen anledning efterfrågas.`}
              confirmLabel="Neka"
              tone="neutral"
            >
              Nej, vi behöver personen själva
            </ConfirmButton>
          </form>
        </section>
      ) : null}

      {mayCancel ? (
        <form action={cancelExtraShiftAction} className="mt-5">
          <input type="hidden" name="requestId" value={request.id} />
          <ConfirmButton
            className="min-h-tap w-full rounded-2xl border border-control px-4 text-sm font-medium transition hover:bg-raised"
            title="Återkalla förfrågan?"
            body={`${request.employee.homeStore.name} behöver inte längre svara.`}
            confirmLabel="Återkalla"
            tone="neutral"
          >
            Återkalla förfrågan
          </ConfirmButton>
        </form>
      ) : null}

      {request.status === "ACCEPTED" ? (
        <p className="mt-5 rounded-2xl border border-success bg-raised p-4 text-sm text-success">
          <span aria-hidden>✓ </span>Passet ligger i {request.requestingStore.name}s schema och är
          markerat som extrapass.{" "}
          <Link
            href={`/store/schedule?store=${request.requestingStore.id}&date=${request.date}`}
            className="underline underline-offset-4"
          >
            Visa i schemat
          </Link>
        </p>
      ) : null}

      <section className="mt-6">
        <h2 className="text-lg font-semibold tracking-tight">Händelser</h2>
        <ol className="mt-2 space-y-2">
          {request.events.map((event) => (
            <li key={event.id} className="rounded-xl border border-line bg-surface p-3 text-sm">
              <span className="block font-medium">
                {EVENT_LABELS[event.type] ?? event.type}
                {event.detail ? ` — ${event.detail}` : ""}
              </span>
              <span className="block text-xs text-muted">
                {formatDateTime(event.at)}
                {event.byName ? ` · ${event.byName}` : ""}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
