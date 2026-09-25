import Link from "next/link";
import { logoutAction } from "@/lib/auth-actions";
import { canAccessAllStores } from "@/lib/roles";
import { getSessionUser } from "@/lib/session";

const LINK =
  "block whitespace-nowrap rounded-lg px-3 py-2 text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900";

/**
 * Server component: the nav reflects who is signed in, and the knowledge guide
 * is always reachable whether or not anyone is.
 *
 * Signed in there are six destinations plus sign-out, which do not fit inline
 * until roughly 1024px — a tablet clips them just as a phone does. Below `lg`
 * they collapse into a <details> menu: a disclosure rather than a state-driven
 * dropdown, so this stays a server component and works before hydration.
 */
export default async function SiteNav() {
  const user = await getSessionUser();
  const isAdmin = user ? canAccessAllStores(user.role) : false;

  const links = [
    { href: "/staff", label: "Guide" },
    ...(user
      ? [
          { href: "/news", label: "Nyheter" },
          { href: "/my-schedule", label: "Schema" },
          { href: "/team-schedule", label: "Team" },
          { href: "/orders", label: "Tidigare" },
          ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
        ]
      : []),
  ];

  if (!user) {
    return (
      <nav className="flex shrink-0 items-center gap-1 text-sm">
        <Link href="/staff" className={LINK}>
          Guide
        </Link>
        <Link href="/login" className={LINK}>
          Logga in
        </Link>
      </nav>
    );
  }

  return (
    <>
      {/* Phones and tablets: one button, everything behind it. */}
      <details className="relative shrink-0 text-sm lg:hidden">
        <summary className="flex h-10 cursor-pointer list-none items-center rounded-lg px-3 text-zinc-600 transition hover:bg-zinc-100 [&::-webkit-details-marker]:hidden">
          Meny
        </summary>
        <nav className="absolute right-0 z-40 mt-1 w-56 rounded-2xl border border-zinc-200 bg-white p-1 shadow-lg">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={LINK}>
              {link.label}
            </Link>
          ))}
          <form action={logoutAction} className="border-t border-zinc-100 pt-1">
            <button type="submit" className={`${LINK} w-full text-left`}>
              Logga ut
            </button>
          </form>
        </nav>
      </details>

      {/* Desktop: the links inline. */}
      <nav className="hidden shrink-0 items-center gap-1 text-sm lg:flex">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className={LINK}>
            {link.label}
          </Link>
        ))}
        <form action={logoutAction}>
          <button type="submit" className={LINK}>
            Logga ut
          </button>
        </form>
      </nav>
    </>
  );
}
