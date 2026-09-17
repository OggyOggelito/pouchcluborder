import { prisma } from "@/lib/db";
import { toRole, type Role } from "@/lib/roles";

export type UserRecord = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  stores: { id: string; name: string; slug: string; city: string | null }[];
};

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  storeAccess: {
    select: { store: { select: { id: true, name: true, slug: true, city: true } } },
    orderBy: { store: { name: "asc" } },
  },
} as const;

type RawUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  storeAccess: { store: { id: string; name: string; slug: string; city: string | null } }[];
};

function toRecord(user: RawUser): UserRecord {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: toRole(user.role),
    stores: user.storeAccess.map((access) => access.store),
  };
}

export async function getUserById(id: string): Promise<UserRecord | null> {
  const user = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
  return user ? toRecord(user as RawUser) : null;
}

/** Email + hash, for the credentials provider only. */
export async function getUserForSignIn(
  email: string
): Promise<{ id: string; email: string; hashedPassword: string } | null> {
  return prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, email: true, hashedPassword: true },
  });
}

export async function listUsers(): Promise<UserRecord[]> {
  const users = await prisma.user.findMany({ orderBy: { email: "asc" }, select: USER_SELECT });
  return users.map((user) => toRecord(user as RawUser));
}

export async function createUser(input: {
  email: string;
  hashedPassword: string;
  name: string | null;
  role: Role;
  storeIds: string[];
}): Promise<UserRecord> {
  const user = await prisma.user.create({
    data: {
      email: input.email.trim().toLowerCase(),
      hashedPassword: input.hashedPassword,
      name: input.name,
      role: input.role,
      storeAccess: { create: input.storeIds.map((storeId) => ({ storeId })) },
    },
    select: USER_SELECT,
  });
  return toRecord(user as RawUser);
}

/** Replaces a user's store access with exactly this set. */
export async function setStoreAccess(userId: string, storeIds: string[]): Promise<void> {
  await prisma.$transaction([
    prisma.storeAccess.deleteMany({ where: { userId } }),
    prisma.storeAccess.createMany({
      data: storeIds.map((storeId) => ({ userId, storeId })),
    }),
  ]);
}

export async function setPassword(userId: string, hashedPassword: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { hashedPassword } });
}

export async function countUsers(): Promise<number> {
  return prisma.user.count();
}
