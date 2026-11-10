import { prisma } from "@/lib/db";
import {
  availableFor,
  nearbyIsFromRegion,
  nearbyStoreIds,
  type AvailabilityRow,
} from "@/lib/schedule/availability";

/**
 * "Lediga hos andra butiker".
 *
 * The query is built so the answer cannot accidentally be more than it should
 * be: candidate rows carry a name, a home store and a consent flag, and the
 * shift rows are read for the overlap test and then thrown away. There is no
 * code path here that could return another store's hours even if a view asked.
 */
export type AvailabilityResult = {
  rows: AvailabilityRow[];
  /** Which stores were searched, for the "varför ser jag dessa?" line. */
  searchedStores: { id: string; name: string }[];
  /** True while nobody has configured pairs and region is deciding. */
  fromRegion: boolean;
};

export async function getAvailability(input: {
  requestingStoreId: string;
  date: string;
  startsAt?: string | null;
  endsAt?: string | null;
  /** An ADMIN is not limited by the nearby setting. */
  seesAllStores: boolean;
}): Promise<AvailabilityResult> {
  const [stores, pairs] = await Promise.all([
    prisma.store.findMany({ select: { id: true, name: true, region: true } }),
    prisma.storeNearby.findMany({ select: { storeId: true, nearbyStoreId: true } }),
  ]);

  const visibleStoreIds = input.seesAllStores
    ? stores.filter((store) => store.id !== input.requestingStoreId).map((store) => store.id)
    : nearbyStoreIds({ storeId: input.requestingStoreId, stores, pairs });

  if (visibleStoreIds.length === 0) {
    return { rows: [], searchedStores: [], fromRegion: nearbyIsFromRegion(pairs) };
  }

  const candidates = await prisma.employee.findMany({
    where: {
      homeStoreId: { in: visibleStoreIds },
      active: true,
      openToExtraShifts: true,
    },
    select: {
      id: true,
      name: true,
      homeStoreId: true,
      active: true,
      openToExtraShifts: true,
      homeStore: { select: { name: true } },
    },
  });

  const [shiftsThatDay, pendingRequests] = await Promise.all([
    candidates.length === 0
      ? Promise.resolve([])
      : prisma.scheduleShift.findMany({
          where: {
            date: input.date,
            employeeId: { in: candidates.map((candidate) => candidate.id) },
          },
          // Times only. Never the store, never the note — this result decides
          // a filter and then goes out of scope.
          select: { employeeId: true, startsAt: true, endsAt: true },
        }),
    prisma.extraShiftRequest.findMany({
      where: {
        requestingStoreId: input.requestingStoreId,
        date: input.date,
        status: "REQUESTED",
      },
      select: { employeeId: true, date: true },
    }),
  ]);

  const byId = new Map(stores.map((store) => [store.id, store]));

  return {
    rows: availableFor({
      requestingStoreId: input.requestingStoreId,
      date: input.date,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      candidates: candidates.map((candidate) => ({
        employeeId: candidate.id,
        name: candidate.name,
        homeStoreId: candidate.homeStoreId,
        homeStoreName: candidate.homeStore.name,
        active: candidate.active,
        openToExtraShifts: candidate.openToExtraShifts,
      })),
      shiftsThatDay,
      visibleStoreIds,
      pendingRequests,
    }),
    searchedStores: visibleStoreIds
      .flatMap((id) => {
        const store = byId.get(id);
        return store ? [{ id: store.id, name: store.name }] : [];
      })
      .sort((a, b) => a.name.localeCompare(b.name, "sv")),
    fromRegion: nearbyIsFromRegion(pairs),
  };
}
