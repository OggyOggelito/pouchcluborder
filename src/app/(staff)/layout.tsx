import Link from "next/link";
import BottomBar from "@/components/nav/BottomBar";
import Wordmark from "@/components/nav/Wordmark";
import GlobalSearch from "@/components/nav/GlobalSearch";
import Sidebar from "@/components/nav/Sidebar";
import SignOutButton from "@/components/nav/SignOutButton";
import { bottomBarFor, groupedNavFor } from "@/config/navigation";
import { getFeatures } from "@/lib/features";
import { countUnreadNews } from "@/lib/repositories/preferences";
import { getSessionUser } from "@/lib/session";

/**
 * The staff app shell.
 *
 * One header everywhere, a bottom bar on phones and a sidebar from `lg` up,
 * all rendered from src/config/navigation.ts so a new feature appears in every
 * menu at once. Feature flags are resolved here and passed down, so an
 * unconfigured module is never offered.
 *
 * Nothing here is ever rendered for a supplier: this layout covers the
 * `(staff)` route group only, and the supplier app is outside it with a shell
 * of its own. A supplier session cannot even reach these routes — its cookie
 * is scoped to `/supplier`.
 */
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const features = await getFeatures();

  const role = user?.role ?? null;
  const sections = groupedNavFor(role, features);
  const bottomEntries = bottomBarFor(role, features);
  const unreadNews = user && features.news ? await countUnreadNews(user.id) : 0;

  return (
    <>
      <a
        href="#innehall"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-xl focus:bg-primary focus:px-4 focus:py-3 focus:text-on-primary"
      >
        Hoppa till innehållet
      </a>

      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-[82rem] items-center justify-between gap-3 px-3 py-2">
          <Link href="/idag" className="flex min-h-11 items-center rounded-xl px-1">
            <Wordmark />
          </Link>

          <div className="flex items-center gap-1">
            <GlobalSearch />
            {!user ? (
              <Link
                href="/login"
                className="flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-ink transition hover:bg-raised"
              >
                Logga in
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[82rem] gap-4 px-0 lg:px-3">
        {user ? (
          <Sidebar sections={sections} signOut={<SignOutButton />} newsBadge={unreadNews} />
        ) : null}

        {/* A div, not a <main>: every page already renders its own <main>,
            and nesting one inside another is invalid and breaks the landmark.
            pb-24 clears the bottom bar on phones; lg drops it again. */}
        <div id="innehall" className="min-w-0 flex-1 pb-24 lg:pb-0">
          {children}
        </div>
      </div>

      {user ? (
        <BottomBar
          entries={bottomEntries}
          sections={sections}
          signOut={<SignOutButton />}
          newsBadge={unreadNews}
        />
      ) : null}
    </>
  );
}
