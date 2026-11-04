import Link from "next/link";
import { logoutAction } from "@/lib/auth-actions";
import { navFor, primaryNavFor } from "@/config/navigation";
import { getSessionUser } from "@/lib/session";

const LINK =
  "block whitespace-nowrap rounded-lg px-3 py-2 text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900";

const GROUP_LABELS: Record<string, string> = {
  staff: "I butiken",
  manager: "Butiksansvarig",
  admin: "Admin",
};

/**
 * Server component: the nav reflects who is signed in, and the knowledge guide
 * is always reachable whether or not anyone is.
 *
 * A signed-in user now has thirteen destinations, which no header fits inline.
 * So the bar shows the `primary` ones from src/config/navigation.ts and a
 * "Meny" button holds all of them, grouped. Below `lg` only the button shows.
 * It is a <details> disclosure rather than a state-driven dropdown, so this
 * stays a server component and works before hydration.
 */
export default async function SiteNav() {
  const user = await getSessionUser();

  // Routes are registered in src/config/navigation.ts, not here.
  const links = navFor(user?.role ?? null);

  if (!user) {
    return (
      <nav className="flex shrink-0 items-center gap-1 text-sm">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className={LINK}>
            {link.label}
          </Link>
        ))}
        <Link href="/login" className={LINK}>
          Logga in
        </Link>
      </nav>
    );
  }

  const primary = primaryNavFor(user.role);
  const groups = (["staff", "manager", "admin"] as const)
    .map((group) => ({ group, entries: links.filter((link) => link.group === group) }))
    .filter((section) => section.entries.length > 0);

  return (
    <div className="flex shrink-0 items-center gap-1 text-sm">
      {/* Desktop: the handful reached mid-shift. */}
      <nav className="hidden items-center gap-1 lg:flex">
        {primary.map((link) => (
          <Link key={link.href} href={link.href} className={LINK}>
            {link.label}
          </Link>
        ))}
      </nav>

      {/* Everything, at every width. */}
      <details className="relative shrink-0">
        <summary className="flex h-10 cursor-pointer list-none items-center rounded-lg px-3 text-zinc-600 transition hover:bg-zinc-100 [&::-webkit-details-marker]:hidden">
          Meny
        </summary>
        <nav className="absolute right-0 z-40 mt-1 max-h-[75vh] w-60 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-1 shadow-lg">
          {groups.map((section) => (
            <div key={section.group} className="border-b border-zinc-100 pb-1 last:border-b-0">
              <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
                {GROUP_LABELS[section.group] ?? section.group}
              </p>
              {section.entries.map((link) => (
                <Link key={link.href} href={link.href} className={LINK}>
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
          <form action={logoutAction} className="border-t border-zinc-100 pt-1">
            <button type="submit" className={`${LINK} w-full text-left`}>
              Logga ut
            </button>
          </form>
        </nav>
      </details>
    </div>
  );
}
