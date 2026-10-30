/**
 * Roles. Deliberately a string union over a Prisma enum so another role can be
 * added without a migration.
 *
 * Listed least- to most-privileged; `/admin/users` renders them in this order.
 */
export const ROLES = ["STAFF", "OWNER", "ADMIN"] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  STAFF: "Butikspersonal",
  OWNER: "Butiksägare",
  ADMIN: "Administratör",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  STAFF: "Guide, produktsök, nyheter, eget schema, checklistor och quiz.",
  OWNER: "Allt ovan, plus beställningar och teamschema för sina butiker.",
  ADMIN: "Allt, inklusive adminsidorna.",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Unknown values fall back to the least privileged role rather than throwing. */
export function toRole(value: unknown): Role {
  return isRole(value) ? value : "STAFF";
}

// ---------------------------------------------------------------------------
// Capabilities
//
// Pages and routes ask these rather than comparing role strings, so adding a
// role later means editing this file instead of hunting for `=== "ADMIN"`.
// ---------------------------------------------------------------------------

/** ADMIN sees every store; everyone else only their StoreAccess rows. */
export function canAccessAllStores(role: Role): boolean {
  return role === "ADMIN";
}

/** Placing and viewing orders. STAFF cannot order. */
export function canPlaceOrders(role: Role): boolean {
  return role === "OWNER" || role === "ADMIN";
}

/** The team coverage grid — a manager's view of everyone's whereabouts. */
export function canViewTeamSchedule(role: Role): boolean {
  return role === "OWNER" || role === "ADMIN";
}

/** Any /admin page. */
export function canAccessAdmin(role: Role): boolean {
  return role === "ADMIN";
}

/**
 * Which stores a role may see, given the user's own StoreAccess rows and the
 * full list.
 *
 * Pure so the scoping rule can be tested without a database or a session. The
 * server helpers in src/lib/session.ts delegate here rather than repeating the
 * `role === "ADMIN"` check.
 */
export function visibleStoreIds(
  role: Role,
  ownStoreIds: string[],
  allStoreIds: string[]
): string[] {
  return canAccessAllStores(role) ? [...allStoreIds] : [...ownStoreIds];
}

/** Whether a role may act on a specific store. */
export function canActOnStore(role: Role, ownStoreIds: string[], storeId: string): boolean {
  if (canAccessAllStores(role)) return true;
  return ownStoreIds.includes(storeId);
}
