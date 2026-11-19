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
  OWNER: "Allt ovan, plus beställningar, schemaläggning och teamschema för sina butiker.",
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
 * Archiving a shift note — taking an IMPORTANT handover off the top of the
 * feed. Anyone may write one; deciding it has been dealt with is the shift
 * manager's call, so STAFF cannot.
 */
export function canArchiveNotes(role: Role): boolean {
  return role === "OWNER" || role === "ADMIN";
}

/**
 * Deleting a shift note. ADMIN only, and the only destructive action in the
 * feature: archiving is what everyone else gets, and an archived note is still
 * readable.
 */
export function canDeleteNotes(role: Role): boolean {
  return role === "ADMIN";
}

/** The problem-report queue at /admin/issues, and being assignable to one. */
export function canManageIssues(role: Role): boolean {
  return role === "ADMIN";
}

/** Writing and publishing routine articles. */
export function canEditRoutines(role: Role): boolean {
  return role === "ADMIN";
}

// ---------------------------------------------------------------------------
// Teamschema
//
// The schedule is entered by the stores themselves, so an OWNER writes here
// rather than only reading. Scope is a separate question from capability:
// these say what a role may do at all, and `canActOnStore` says where.
// ---------------------------------------------------------------------------

/** Entering and changing shifts in the week grid. STAFF may only look. */
export function canEditSchedule(role: Role): boolean {
  return role === "OWNER" || role === "ADMIN";
}

/** Adding employees, linking accounts, deactivating people who have left. */
export function canManageEmployees(role: Role): boolean {
  return role === "OWNER" || role === "ADMIN";
}

/**
 * Seeing who is free at other stores, and asking for them.
 *
 * STAFF deliberately cannot: this is the one view where an employee is visible
 * to people outside their own shop, and it exists for the managers who do the
 * asking.
 */
export function canViewAvailability(role: Role): boolean {
  return role === "OWNER" || role === "ADMIN";
}

/** A store's opening hours and its holiday exceptions. */
export function canEditOpeningHours(role: Role): boolean {
  return role === "OWNER" || role === "ADMIN";
}

/**
 * Deciding which stores may see each other's free staff. ADMIN only — it
 * controls who sees whose employees, which is not one store's call.
 */
export function canManageNearbyStores(role: Role): boolean {
  return role === "ADMIN";
}

// ---------------------------------------------------------------------------
// Supplier portal, statistics and the order pause
//
// `SUPPLIER` is deliberately absent from `ROLES`. A supplier is not a staff
// account with fewer rights: they are an external person, they live in their
// own table, they sign in through their own door and their session cookie
// never reaches a staff route. Adding the string here would put it in the
// admin role picker, which is the one place it must never appear.
// ---------------------------------------------------------------------------

/** Creating supplier accounts and issuing their links. */
export function canManageSuppliers(role: Role): boolean {
  return role === "ADMIN";
}

/** Confirming or declining a demo day. The store answers for its own day. */
export function canDecideDemoDays(role: Role): boolean {
  return role === "OWNER" || role === "ADMIN";
}

/** Pausing ordering, and lifting a pause. */
export function canPauseOrders(role: Role): boolean {
  return role === "ADMIN";
}

/**
 * Pushing an order through a pause, with a reason that is logged.
 *
 * Same answer as `canPauseOrders` today, and a separate function anyway:
 * "may stop everyone ordering" and "may ignore that for one order" are
 * different powers, and one of them is far more likely to be delegated.
 */
export function canOverrideOrderPause(role: Role): boolean {
  return role === "ADMIN";
}

/**
 * The sales statistics.
 *
 * A role is not enough: the per-account `canViewStats` flag has to be on too.
 * Written as a predicate over both so no page can get the rule half right.
 */
export function canViewSalesStats(input: { role: Role; canViewStats: boolean }): boolean {
  return input.role === "ADMIN" && input.canViewStats;
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
