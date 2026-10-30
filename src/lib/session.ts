import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserById, type UserRecord } from "@/lib/repositories/users";
import { listStores, type StoreSummary } from "@/lib/repositories/stores";
import {
  canAccessAdmin,
  canAccessAllStores,
  canActOnStore,
  canPlaceOrders,
} from "@/lib/roles";

/**
 * The real authorization check, done in the data layer rather than in proxy.ts.
 * The Next docs are explicit that proxy is for optimistic redirects only, so
 * every protected page and route calls one of these.
 *
 * Memoized per render pass with React's cache, so a layout and a page asking
 * for the user in the same request share one query.
 */
export const getSessionUser = cache(async (): Promise<UserRecord | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  // Read through to the database rather than trusting the JWT's contents, so
  // removing a store or deleting a user takes effect on the next request.
  return getUserById(id);
});

/** Redirects to /login when signed out. `next` brings them back afterwards. */
export async function requireUser(next?: string): Promise<UserRecord> {
  const user = await getSessionUser();
  if (!user) {
    redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  }
  return user;
}

/** Stores this user may order for — every store for an ADMIN. */
export const storesForUser = cache(async (user: UserRecord): Promise<StoreSummary[]> => {
  if (canAccessAllStores(user.role)) return listStores();
  return user.stores;
});

export async function canOrderForStore(user: UserRecord, storeId: string): Promise<boolean> {
  // Delegates to the pure rule in roles.ts, which is what the permission tests
  // exercise — so the tested logic is the logic that runs.
  return canActOnStore(
    user.role,
    user.stores.map((store) => store.id),
    storeId
  );
}

/**
 * For the admin area. Signed-out users go to /login; a signed-in OWNER gets a
 * 404 rather than a redirect loop.
 */
export async function requireAdmin(): Promise<UserRecord> {
  const user = await requireUser("/admin");
  if (!canAccessAdmin(user.role)) {
    notFound();
  }
  return user;
}

/**
 * For the ordering flow. STAFF can read the guide and their own schedule but
 * cannot order, so they get a 404 rather than a redirect loop.
 */
export async function requireOrderingUser(next?: string): Promise<UserRecord> {
  const user = await requireUser(next);
  if (!canPlaceOrders(user.role)) {
    notFound();
  }
  return user;
}
