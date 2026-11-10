/**
 * "Who is free at the other shops?"
 *
 * The one place in the app where an employee is visible to somebody who is not
 * their own manager, so it is deliberately the thinnest view in the codebase:
 * a name, a home store, and the word "ledig". Not their hours, not where they
 * are working instead, not their notes, not a phone number. A manager who
 * wants somebody asks their store; it is that store's staff.
 *
 * Nearby is never inferred from geography. Two shops a kilometre apart in the
 * same mall and two shops four hours away both come back from the same lookup,
 * and that lookup is a decision an admin made.
 *
 * Pure, so the scoping rules are tested without a database.
 */
import { overlaps } from "@/lib/schedule/time";


export type NearbyPair = { storeId: string; nearbyStoreId: string };

/**
 * Which other stores this store may see free staff at.
 *
 * Explicit pairs win as soon as any exist anywhere in the table: once an admin
 * has started deciding, the region default stops applying, including to stores
 * they have not got to yet. The alternative — falling back per store — means
 * unlinking a pair silently re-opens the whole region, which is the wrong way
 * round for something that controls who sees staff.
 */
export function nearbyStoreIds(input: {
  storeId: string;
  stores: { id: string; region: string | null }[];
  pairs: NearbyPair[];
}): string[] {
  if (input.pairs.length > 0) {
    return [
      ...new Set(
        input.pairs
          .filter((pair) => pair.storeId === input.storeId && pair.nearbyStoreId !== input.storeId)
          .map((pair) => pair.nearbyStoreId)
      ),
    ];
  }

  const own = input.stores.find((store) => store.id === input.storeId);
  if (!own?.region) return [];

  return input.stores
    .filter((store) => store.id !== input.storeId && store.region === own.region)
    .map((store) => store.id);
}

/** True while nothing is configured and region is doing the work. */
export function nearbyIsFromRegion(pairs: NearbyPair[]): boolean {
  return pairs.length === 0;
}

export type AvailabilityCandidate = {
  employeeId: string;
  name: string;
  homeStoreId: string;
  homeStoreName: string;
  active: boolean;
  openToExtraShifts: boolean;
};

/** Exactly what another store gets to see. Nothing is added to this type. */
export type AvailabilityRow = {
  employeeId: string;
  name: string;
  homeStoreName: string;
  /** True when a request for this person and day is already out. */
  alreadyAsked: boolean;
};

/**
 * Who could work at the asking store on this date.
 *
 * Without times, "free" means no shift at all that day — the honest answer to
 * "can anyone do Saturday?". With times it means no shift that overlaps them,
 * so a morning person can still be asked about an evening.
 *
 * `shiftsThatDay` must hold every shift the candidates have that day at any
 * store. The times never leave this function: they decide the filter and are
 * then dropped.
 */
export function availableFor(input: {
  requestingStoreId: string;
  date: string;
  startsAt?: string | null;
  endsAt?: string | null;
  candidates: AvailabilityCandidate[];
  shiftsThatDay: { employeeId: string; startsAt: string; endsAt: string }[];
  /** Home stores whose staff the asking store may see. */
  visibleStoreIds: string[];
  pendingRequests?: { employeeId: string; date: string }[];
}): AvailabilityRow[] {
  const visible = new Set(input.visibleStoreIds);
  const asked = new Set(
    (input.pendingRequests ?? [])
      .filter((request) => request.date === input.date)
      .map((request) => request.employeeId)
  );

  const busy = new Set<string>();
  for (const shift of input.shiftsThatDay) {
    if (!wantsWindow(input)) {
      busy.add(shift.employeeId);
      continue;
    }
    if (overlaps(shift, { startsAt: input.startsAt!, endsAt: input.endsAt! })) {
      busy.add(shift.employeeId);
    }
  }

  return input.candidates
    .filter(
      (candidate) =>
        candidate.active &&
        // Consent, not configuration. Off by default, and an admin override
        // would make the setting meaningless to the person who set it.
        candidate.openToExtraShifts &&
        candidate.homeStoreId !== input.requestingStoreId &&
        visible.has(candidate.homeStoreId) &&
        !busy.has(candidate.employeeId)
    )
    .map((candidate) => ({
      employeeId: candidate.employeeId,
      name: candidate.name,
      homeStoreName: candidate.homeStoreName,
      alreadyAsked: asked.has(candidate.employeeId),
    }))
    .sort(
      (a, b) =>
        a.homeStoreName.localeCompare(b.homeStoreName, "sv") || a.name.localeCompare(b.name, "sv")
    );
}

function wantsWindow(input: { startsAt?: string | null; endsAt?: string | null }): boolean {
  return Boolean(input.startsAt && input.endsAt);
}
