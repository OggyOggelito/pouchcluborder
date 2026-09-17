/**
 * Roles. Deliberately a string union over a Prisma enum so another role can be
 * added without a migration — only these two exist today.
 */
export const ROLES = ["OWNER", "ADMIN"] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Butiksägare",
  ADMIN: "Administratör",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Unknown values fall back to the least privileged role rather than throwing. */
export function toRole(value: unknown): Role {
  return isRole(value) ? value : "OWNER";
}

/** ADMIN sees every store; OWNER only the stores granted in StoreAccess. */
export function canAccessAllStores(role: Role): boolean {
  return role === "ADMIN";
}
