import Link from "next/link";
import { logoutAction } from "@/lib/auth-actions";
import { canAccessAllStores } from "@/lib/roles";
import { getSessionUser } from "@/lib/session";

const LINK =
  "whitespace-nowrap rounded-lg px-2.5 py-2 text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 sm:px-3";

/**
 * Server component: the nav reflects who is signed in, and the knowledge guide
 * is always reachable whether or not anyone is.
 */
export default async function SiteNav() {
  const user = await getSessionUser();
  const isAdmin = user ? canAccessAllStores(user.role) : false;

  return (
    <nav className="flex shrink-0 items-center gap-0.5 text-sm sm:gap-1">
      <Link href="/staff" className={LINK}>
        Guide
      </Link>

      {user ? (
        <>
          <Link href="/orders" className={LINK}>
            Tidigare
          </Link>
          {isAdmin ? (
            <Link href="/admin" className={LINK}>
              Admin
            </Link>
          ) : null}
          <form action={logoutAction}>
            <button type="submit" className={LINK}>
              Logga ut
            </button>
          </form>
        </>
      ) : (
        <Link href="/login" className={LINK}>
          Logga in
        </Link>
      )}
    </nav>
  );
}
