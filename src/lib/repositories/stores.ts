import { prisma } from "@/lib/db";

export type StoreSummary = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
};

export async function listStores(): Promise<StoreSummary[]> {
  return prisma.store.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true, city: true },
  });
}

export async function getStoreById(id: string): Promise<StoreSummary | null> {
  if (!id) return null;
  return prisma.store.findUnique({
    where: { id },
    select: { id: true, name: true, slug: true, city: true },
  });
}
