import Link from "next/link";
import Card from "@/components/ui/Card";
import ErrorState from "@/components/ui/ErrorState";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { stockholmDateKey } from "@/lib/checklists";
import { getFeatures } from "@/lib/features";
import { formatShortDate } from "@/lib/format";
import { countOf } from "@/lib/terms";
import { getAdminCounts } from "@/lib/repositories/admin-counts";
import { getTodayChecklists } from "@/lib/repositories/checklists";
import { listDraftsForUser } from "@/lib/repositories/order-drafts";
import { listPublished } from "@/lib/repositories/announcements";
import { countUnreadNews } from "@/lib/repositories/preferences";
import { countIncomingRequests } from "@/lib/repositories/extra-shifts";
import { countShiftsForStores } from "@/lib/repositories/schedule-week";
import { canAccessAdmin, canPlaceOrders, canViewAvailability } from "@/lib/roles";
import { getMyShifts } from "@/lib/schedule/queries";
import { lineCount, totalQuantity } from "@/lib/order-drafts";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Idag — Pouch Club",
};

/**
 * "Idag" — the first screen for everyone, whatever their role.
 *
 * Before this, `/` was the order form, which 404'd for STAFF: the largest
 * group of users opened the app onto Next's default English "This page could
 * not be found". Now every role lands somewhere useful.
 *
 * Every card hides completely when it has nothing to say or its feature is not
 * configured. A greyed-out card is still a thing to read and decide about on a
 * phone in a stockroom; an absent one is not.
 */
export default async function TodayPage() {
  const user = await requireUser("/");
  const features = await getFeatures();

  // Deliberately the user's OWN stores, not every store an admin may open.
  // "Checklistor idag" is about shifts this person is working; an admin with
  // access to all five stores is not personally doing Helsingborgs öppning,
  // and listing ten checklists on their home screen is noise, not a task.
  const stores = user.stores;
  const storeIds = stores.map((store) => store.id);
  const mayOrder = canPlaceOrders(user.role);
  const isAdmin = canAccessAdmin(user.role);

  const mayManageSchedule = canViewAvailability(user.role);

  const [
    shifts,
    checklists,
    drafts,
    unreadNews,
    latestNews,
    adminCounts,
    extraShifts,
    storeShiftCount,
  ] = await Promise.all([
    features.schedule ? getMyShifts(user.id) : null,
    features.checklists
      ? getTodayChecklists({ storeIds, dateKey: stockholmDateKey() })
      : [],
    mayOrder && features.ordering ? listDraftsForUser(user.id) : [],
    features.news ? countUnreadNews(user.id) : 0,
    features.news ? listPublished(undefined, 3) : [],
    isAdmin ? getAdminCounts() : null,
    mayManageSchedule ? countIncomingRequests(storeIds) : 0,
    mayManageSchedule && features.schedule ? countShiftsForStores(storeIds) : 1,
  ]);

  // ShiftEntry.date is a Date at local midnight; compare on the Stockholm
  // date key rather than the instant, so a shift does not jump a day.
  const todayKey = stockholmDateKey();
  const todaysShifts =
    shifts?.ok === true
      ? shifts.data.entries.filter((entry) => stockholmDateKey(entry.date) === todayKey)
      : [];
  const scheduleFailed = shifts !== null && shifts.ok === false;

  const openChecklists = checklists.filter((checklist) => !checklist.complete);
  const outstandingAdmin = adminCounts
    ? adminCounts.openIssues + adminCounts.newRequests + adminCounts.needsReview
    : 0;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      {/* No greeting by name: accounts are per store as often as per person
          ("Pouch Club Admin", "Täby Centrum"), and "Hej Täby" is worse than
          no greeting at all. */}
      <PageHeader title="Idag" description={formatShortDate(new Date())} />

      {/* The one big button. First, because for an OWNER it is why the app
          exists. */}
      {mayOrder && features.ordering ? (
        <div className="mb-3">
          <Link
            href="/order"
            className="flex min-h-16 items-center justify-center rounded-2xl bg-primary px-6 text-lg font-semibold text-on-primary transition active:scale-[0.99]"
          >
            Ny beställning
          </Link>
        </div>
      ) : null}

      {drafts.length > 0 ? (
        <section className="mb-3">
          <ul className="space-y-2">
            {drafts.map((draft) => (
              <li key={draft.storeId}>
                <Card href={`/order?store=${draft.storeId}`} className="border-primary">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block font-semibold tracking-tight">
                        Fortsätt beställning
                      </span>
                      <span className="block text-sm text-muted">
                        {stores.length > 1 ? `${draft.storeName} · ` : ""}
                        {lineCount(draft.lines) === 1
                          ? "1 produkt"
                          : `${lineCount(draft.lines)} produkter`}
                        {" · "}
                        {countOf("stock", totalQuantity(draft.lines))}
                      </span>
                    </span>
                    <StatusBadge tone="success">Utkast</StatusBadge>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {scheduleFailed ? (
        <div className="mb-3">
          <ErrorState
            title="Schemat kunde inte hämtas"
            detail="Dina pass visas inte just nu. Det betyder inte att du är ledig — kolla med butiksansvarig."
          />
        </div>
      ) : todaysShifts.length > 0 ? (
        <Card className="mb-3">
          <h2 className="font-semibold tracking-tight">Ditt pass idag</h2>
          <ul className="mt-2 space-y-1">
            {todaysShifts.map((entry, index) => (
              <li key={`${entry.date.toISOString()}-${index}`} className="text-[15px] text-ink">
                <span className="font-medium tabular-nums">
                  {entry.startTime}–{entry.endTime}
                </span>{" "}
                · {entry.storeName}
              </li>
            ))}
          </ul>
          <Link
            href="/schedule"
            className="mt-3 inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4"
          >
            Hela schemat
          </Link>
        </Card>
      ) : null}

      {/* A store with nothing entered is not an error and not an outage — it
          is a job for whoever runs the rota. Said once, to them. */}
      {mayManageSchedule && features.schedule && storeShiftCount === 0 ? (
        <Card href="/store/schedule" className="mb-3">
          <span className="block font-semibold tracking-tight">Inget schema inlagt ännu</span>
          <span className="mt-1 block text-sm text-muted">
            Butikens vecka är tom. Lägg in passen i teamschemat.
          </span>
        </Card>
      ) : null}

      {extraShifts > 0 ? (
        <Card href="/schedule/extra" className="mb-3">
          <div className="flex items-start justify-between gap-3">
            <span className="min-w-0">
              <span className="block font-semibold tracking-tight">
                {extraShifts === 1
                  ? "1 förfrågan om extrapass"
                  : `${extraShifts} förfrågningar om extrapass`}
              </span>
              <span className="block text-sm text-muted">
                En annan butik vill låna någon av era medarbetare.
              </span>
            </span>
            <StatusBadge tone="info">Svara</StatusBadge>
          </div>
        </Card>
      ) : null}

      {openChecklists.length > 0 ? (
        <Card href="/staff/checklists" className="mb-3">
          <div className="flex items-start justify-between gap-3">
            <span className="min-w-0">
              <span className="block font-semibold tracking-tight">Checklistor idag</span>
              <span className="block text-sm text-muted">
                {openChecklists
                  .slice(0, 2)
                  .map(
                    (checklist) =>
                      `${checklist.title}${
                        storeIds.length > 1 ? ` (${checklist.storeName})` : ""
                      } ${checklist.done}/${checklist.total}`
                  )
                  .join(" · ")}
                {openChecklists.length > 2 ? ` · +${openChecklists.length - 2} till` : ""}
              </span>
            </span>
            <StatusBadge tone="warning">{openChecklists.length}</StatusBadge>
          </div>
        </Card>
      ) : null}

      {unreadNews > 0 ? (
        <Card href="/news" className="mb-3">
          <div className="flex items-start justify-between gap-3">
            <span className="min-w-0">
              <span className="block font-semibold tracking-tight">
                {unreadNews === 1 ? "1 oläst nyhet" : `${unreadNews} olästa nyheter`}
              </span>
              <span className="block truncate text-sm text-muted">
                {latestNews[0]?.title ?? ""}
              </span>
            </span>
            <StatusBadge tone="info">Nytt</StatusBadge>
          </div>
        </Card>
      ) : null}

      {isAdmin && outstandingAdmin > 0 && adminCounts ? (
        <Card className="mb-3">
          <span className="block font-semibold tracking-tight">Väntar på dig</span>
          {/* Each count is its own link. The old /admin banner printed a
              number with nothing behind it, which the audit recorded as a
              dead end — a count you cannot tap is just a worry. */}
          <ul className="mt-2 space-y-1">
            {(
              [
                [adminCounts.newRequests, "nya kundönskemål", "/admin/requests"],
                [adminCounts.openIssues, "öppna problemrapporter", "/admin/issues"],
                [adminCounts.needsReview, "produkter att granska", "/admin/review"],
              ] as const
            )
              .filter(([count]) => count > 0)
              .map(([count, label, href]) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="flex min-h-tap items-center justify-between gap-3 rounded-xl px-1 text-[15px] text-ink transition hover:bg-raised"
                  >
                    <span>
                      <span className="font-semibold tabular-nums">{count}</span> {label}
                    </span>
                    <span aria-hidden className="text-muted">
                      ›
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </Card>
      ) : null}

      {/* Nothing above matched: say so plainly rather than showing an empty
          screen that looks broken. */}
      {!scheduleFailed &&
      todaysShifts.length === 0 &&
      openChecklists.length === 0 &&
      unreadNews === 0 &&
      drafts.length === 0 &&
      extraShifts === 0 &&
      !(mayManageSchedule && features.schedule && storeShiftCount === 0) &&
      outstandingAdmin === 0 ? (
        <Card>
          <p className="font-medium text-ink">Inget särskilt idag.</p>
          <p className="mt-1 text-sm text-muted">
            Allt är avbockat och inget nytt väntar.{" "}
            <Link href="/staff" className="underline underline-offset-4">
              Läs på om ett märke
            </Link>{" "}
            så länge.
          </p>
        </Card>
      ) : null}
    </main>
  );
}
