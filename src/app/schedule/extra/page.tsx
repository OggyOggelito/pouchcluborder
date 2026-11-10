import Link from "next/link";
import { notFound } from "next/navigation";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { listRequests } from "@/lib/repositories/extra-shifts";
import {
  EXTRA_SHIFT_NOTICE,
  EXTRA_SHIFT_STATUS_LABELS,
  EXTRA_SHIFT_TABS,
  EXTRA_SHIFT_TAB_LABELS,
  toExtraShiftTab,
  type ExtraShiftStatus,
} from "@/lib/schedule/extra-shifts";
import { formatDateString, formatRange } from "@/lib/schedule/time";
import { canViewAvailability } from "@/lib/roles";
import { requireUser, storesForUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Extrapass — Pouch Club" };

const TONES: Record<ExtraShiftStatus, "info" | "success" | "danger" | "neutral"> = {
  REQUESTED: "info",
  ACCEPTED: "success",
  DECLINED: "danger",
  CANCELLED: "neutral",
};

/**
 * Extra-shift requests, from both sides.
 *
 * "Inkomna" is about our own staff and is ours to answer. "Skickade" is what
 * we have asked of somebody else. Scope comes from the account's stores, so
 * the same page shows a different queue to each store without a filter.
 */
export default async function ExtraShiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser("/schedule/extra");
  if (!canViewAvailability(user.role)) notFound();

  const { tab: tabParam } = await searchParams;
  const tab = toExtraShiftTab(tabParam);

  const stores = await storesForUser(user);
  const requests = await listRequests({ storeIds: stores.map((store) => store.id), tab });

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <PageHeader
        title="Extrapass"
        description={EXTRA_SHIFT_NOTICE}
        action={
          <Link
            href="/schedule/available"
            className="inline-flex min-h-tap items-center rounded-2xl bg-primary px-5 font-semibold text-on-primary transition active:scale-[0.99]"
          >
            Hitta någon ledig
          </Link>
        }
      />

      <div role="tablist" aria-label="Extrapass" className="flex gap-2">
        {EXTRA_SHIFT_TABS.map((candidate) => (
          <Link
            key={candidate}
            href={`/schedule/extra?tab=${candidate}`}
            role="tab"
            aria-selected={candidate === tab}
            className={`min-h-tap flex-1 rounded-full border text-center text-sm leading-[2.75rem] transition ${
              candidate === tab
                ? "border-primary bg-raised font-semibold ring-1 ring-primary"
                : "border-control bg-surface font-medium text-muted"
            }`}
          >
            {EXTRA_SHIFT_TAB_LABELS[candidate]}
          </Link>
        ))}
      </div>

      {requests.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title={
              tab === "incoming"
                ? "Inga förfrågningar att svara på"
                : tab === "outgoing"
                  ? "Ni har inga utestående förfrågningar"
                  : "Inget i historiken ännu"
            }
            description={
              tab === "outgoing"
                ? "Hitta någon ledig hos en närliggande butik och fråga."
                : undefined
            }
          />
        </div>
      ) : (
        <ul className="mt-5 space-y-2">
          {requests.map((request) => (
            <li key={request.id}>
              <Link
                href={`/schedule/extra/${request.id}`}
                className="block min-h-tap rounded-2xl border border-line bg-surface p-4 shadow-sm transition active:scale-[0.99] hover:border-control"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block font-medium">{request.employeeName}</span>
                    <span className="block text-sm text-muted">
                      {request.homeStoreName} → {request.requestingStoreName}
                    </span>
                    <span className="mt-1 block text-sm">
                      <span className="capitalize">{formatDateString(request.date)}</span>{" "}
                      <span className="tabular-nums">
                        {formatRange(request.startsAt, request.endsAt)}
                      </span>
                    </span>
                  </span>
                  <StatusBadge tone={TONES[request.status]}>
                    {EXTRA_SHIFT_STATUS_LABELS[request.status]}
                  </StatusBadge>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
