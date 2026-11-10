import { prisma } from "@/lib/db";
import { nearbyStoreIds, type NearbyPair } from "@/lib/schedule/availability";

export async function listNearbyPairs(): Promise<NearbyPair[]> {
  return prisma.storeNearby.findMany({
    orderBy: [{ storeId: "asc" }, { nearbyStoreId: "asc" }],
    select: { storeId: true, nearbyStoreId: true },
  });
}

/**
 * Links two stores both ways.
 *
 * Nearby is mutual in every case anybody has asked for — if Täby may see
 * Kungsholmen's free staff, Kungsholmen may see Täby's. The table keeps a row
 * per direction anyway, so a one-way relation stays possible later without a
 * migration, and the read stays a single lookup.
 */
export async function linkStores(a: string, b: string): Promise<void> {
  if (a === b) return;

  await prisma.$transaction([
    prisma.storeNearby.upsert({
      where: { storeId_nearbyStoreId: { storeId: a, nearbyStoreId: b } },
      create: { storeId: a, nearbyStoreId: b },
      update: {},
    }),
    prisma.storeNearby.upsert({
      where: { storeId_nearbyStoreId: { storeId: b, nearbyStoreId: a } },
      create: { storeId: b, nearbyStoreId: a },
      update: {},
    }),
  ]);
}

export async function unlinkStores(a: string, b: string): Promise<void> {
  await prisma.storeNearby.deleteMany({
    where: {
      OR: [
        { storeId: a, nearbyStoreId: b },
        { storeId: b, nearbyStoreId: a },
      ],
    },
  });
}

/** Which stores this one may see free staff at, pairs or region. */
export async function nearbyFor(storeId: string): Promise<string[]> {
  const [pairs, stores] = await Promise.all([
    listNearbyPairs(),
    prisma.store.findMany({ select: { id: true, region: true } }),
  ]);
  return nearbyStoreIds({ storeId, stores, pairs });
}

/** Every store with who it can see — the admin page and the report need this. */
export async function nearbyMap(): Promise<
  { store: { id: string; name: string; region: string | null }; nearby: { id: string; name: string }[] }[]
> {
  const [pairs, stores] = await Promise.all([
    listNearbyPairs(),
    prisma.store.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, region: true },
    }),
  ]);
  const byId = new Map(stores.map((store) => [store.id, store]));

  return stores.map((store) => ({
    store,
    nearby: nearbyStoreIds({ storeId: store.id, stores, pairs })
      .flatMap((id) => {
        const found = byId.get(id);
        return found ? [{ id: found.id, name: found.name }] : [];
      })
      .sort((a, b) => a.name.localeCompare(b.name, "sv")),
  }));
}
