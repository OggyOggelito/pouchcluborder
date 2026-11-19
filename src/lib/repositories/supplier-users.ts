import { createHash, randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";

/**
 * Supplier accounts.
 *
 * Every query in this file names `supplierUser`. Nothing that lists staff can
 * reach these rows, and nothing here can reach a staff account — that is the
 * whole reason suppliers are not in `users`.
 *
 * What is stored: an email to sign in with, an optional display name, a
 * password hash, and one brand. There is no field for a phone number, a
 * company address or a contact person, and the admin form has no box for one.
 */
export const INVITE_TTL_HOURS = 72;
const BCRYPT_ROUNDS = 12;

export type SupplierUserView = {
  id: string;
  email: string;
  name: string | null;
  active: boolean;
  mustChangePassword: boolean;
  hasPassword: boolean;
  brand: { id: string; name: string; slug: string };
  invitePending: boolean;
  inviteExpiresAt: Date | null;
  lastLoginAt: Date | null;
};

const SELECT = {
  id: true,
  email: true,
  name: true,
  active: true,
  mustChangePassword: true,
  hashedPassword: true,
  inviteTokenHash: true,
  inviteExpiresAt: true,
  lastLoginAt: true,
  brand: { select: { id: true, name: true, slug: true } },
} as const;

type RawSupplier = {
  id: string;
  email: string;
  name: string | null;
  active: boolean;
  mustChangePassword: boolean;
  hashedPassword: string | null;
  inviteTokenHash: string | null;
  inviteExpiresAt: Date | null;
  lastLoginAt: Date | null;
  brand: { id: string; name: string; slug: string };
};

function toView(row: RawSupplier): SupplierUserView {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    active: row.active,
    mustChangePassword: row.mustChangePassword,
    hasPassword: row.hashedPassword !== null,
    brand: row.brand,
    invitePending: row.inviteTokenHash !== null,
    inviteExpiresAt: row.inviteExpiresAt,
    lastLoginAt: row.lastLoginAt,
  };
}

/** Tokens are stored hashed. The plain value exists only in the link. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * The sign-in lookup for the supplier door.
 *
 * Deliberately its own function and its own table: the staff provider cannot
 * call it and it cannot return a staff account, so a supplier's email typed
 * into the staff form finds nothing — and the reverse.
 */
export async function getSupplierForSignIn(email: string) {
  return prisma.supplierUser.findUnique({
    where: { email: normalizeEmail(email) },
    select: {
      id: true,
      email: true,
      hashedPassword: true,
      active: true,
      brandId: true,
      mustChangePassword: true,
    },
  });
}

/** Read through on every request, like the staff session does. */
export async function getSupplierById(id: string) {
  const row = await prisma.supplierUser.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      active: true,
      mustChangePassword: true,
      bookingsSeenAt: true,
      brand: { select: { id: true, name: true, slug: true } },
    },
  });
  if (!row || !row.active) return null;
  return row;
}

export async function listSupplierUsers(): Promise<SupplierUserView[]> {
  const rows = await prisma.supplierUser.findMany({
    orderBy: [{ active: "desc" }, { email: "asc" }],
    select: SELECT,
  });
  return rows.map(toView);
}

export async function countSupplierUsers(): Promise<{ active: number; pending: number }> {
  const [active, pending] = await Promise.all([
    prisma.supplierUser.count({ where: { active: true } }),
    prisma.supplierUser.count({ where: { active: true, inviteTokenHash: { not: null } } }),
  ]);
  return { active, pending };
}

export class SupplierAccountError extends Error {}

/**
 * Creates an account and the one-time link that activates it.
 *
 * The account is created without a password: until the supplier follows the
 * link and chooses one, there is nothing to guess. The token is returned once,
 * to be handed over by whatever channel the admin already uses — there is no
 * mail transport in this app, and inventing one here would be worse than
 * saying so.
 */
export async function createSupplierUser(input: {
  email: string;
  name: string | null;
  brandId: string;
  invitedById: string;
}): Promise<{ id: string; token: string; expiresAt: Date }> {
  const email = normalizeEmail(input.email);
  if (!email.includes("@")) throw new SupplierAccountError("Ogiltig e-postadress.");

  const existing = await prisma.supplierUser.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) throw new SupplierAccountError("Det finns redan ett konto med den adressen.");

  const token = newToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 3_600_000);

  const created = await prisma.supplierUser.create({
    data: {
      email,
      name: input.name?.trim() || null,
      brandId: input.brandId,
      invitedById: input.invitedById,
      inviteTokenHash: hashToken(token),
      inviteExpiresAt: expiresAt,
      inviteKind: "INVITE",
    },
    select: { id: true },
  });

  return { id: created.id, token, expiresAt };
}

/** A fresh link for an account that never activated, or forgot its password. */
export async function issueToken(
  id: string,
  kind: "INVITE" | "RESET"
): Promise<{ token: string; expiresAt: Date }> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 3_600_000);

  await prisma.supplierUser.update({
    where: { id },
    data: { inviteTokenHash: hashToken(token), inviteExpiresAt: expiresAt, inviteKind: kind },
  });
  return { token, expiresAt };
}

export type TokenLookup =
  | { ok: true; id: string; email: string; kind: string; brandName: string }
  | { ok: false; reason: "unknown" | "expired" | "inactive" };

/**
 * Resolves a link.
 *
 * An unknown token and an expired one are told apart here but not in the UI:
 * the page says "länken gäller inte längre" either way, so the form cannot be
 * used to find out whether a token ever existed.
 */
export async function lookupToken(token: string): Promise<TokenLookup> {
  const row = await prisma.supplierUser.findUnique({
    where: { inviteTokenHash: hashToken(token) },
    select: {
      id: true,
      email: true,
      active: true,
      inviteExpiresAt: true,
      inviteKind: true,
      brand: { select: { name: true } },
    },
  });

  if (!row) return { ok: false, reason: "unknown" };
  if (!row.active) return { ok: false, reason: "inactive" };
  if (!row.inviteExpiresAt || row.inviteExpiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  return {
    ok: true,
    id: row.id,
    email: row.email,
    kind: row.inviteKind ?? "INVITE",
    brandName: row.brand.name,
  };
}

/** Sets the password and burns the token in one write. */
export async function setPasswordWithToken(token: string, password: string): Promise<boolean> {
  const lookup = await lookupToken(token);
  if (!lookup.ok) return false;

  const updated = await prisma.supplierUser.updateMany({
    where: { id: lookup.id, inviteTokenHash: hashToken(token) },
    data: {
      hashedPassword: await hash(password, BCRYPT_ROUNDS),
      mustChangePassword: false,
      inviteTokenHash: null,
      inviteExpiresAt: null,
      inviteKind: null,
    },
  });
  return updated.count > 0;
}

/** Changing your own password while signed in. */
export async function setPassword(id: string, password: string): Promise<void> {
  await prisma.supplierUser.update({
    where: { id },
    data: {
      hashedPassword: await hash(password, BCRYPT_ROUNDS),
      mustChangePassword: false,
      inviteTokenHash: null,
      inviteExpiresAt: null,
      inviteKind: null,
    },
  });
}

export async function setActive(id: string, active: boolean): Promise<void> {
  // Deactivating also burns any outstanding link, so a pending invite cannot
  // be used to walk back in.
  await prisma.supplierUser.update({
    where: { id },
    data: active
      ? { active: true }
      : { active: false, inviteTokenHash: null, inviteExpiresAt: null, inviteKind: null },
  });
}

export async function recordLogin(id: string): Promise<void> {
  await prisma.supplierUser.update({ where: { id }, data: { lastLoginAt: new Date() } });
}

export async function markBookingsSeen(id: string): Promise<void> {
  await prisma.supplierUser.update({ where: { id }, data: { bookingsSeenAt: new Date() } });
}
