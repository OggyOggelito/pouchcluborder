import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  availableFor,
  nearbyIsFromRegion,
  nearbyStoreIds,
  type AvailabilityCandidate,
} from "../src/lib/schedule/availability";

/**
 * The cross-store view is the one place an employee is visible to somebody who
 * is not their own manager, so these tests are about what must NOT come back.
 */
const STORES = [
  { id: "taby", region: "Stockholm" },
  { id: "kungsholmen", region: "Stockholm" },
  { id: "linkoping", region: "Öst" },
  { id: "orebro", region: "Mitt" },
  { id: "nyöppnad", region: null },
];

function employee(
  overrides: Partial<AvailabilityCandidate> & { employeeId: string; homeStoreId: string }
): AvailabilityCandidate {
  return {
    name: overrides.employeeId,
    homeStoreName: overrides.homeStoreId,
    active: true,
    openToExtraShifts: true,
    ...overrides,
  };
}

describe("nearby is a decision, not geography", () => {
  it("falls back to the region while nothing is configured", () => {
    assert.equal(nearbyIsFromRegion([]), true);
    assert.deepEqual(nearbyStoreIds({ storeId: "taby", stores: STORES, pairs: [] }), [
      "kungsholmen",
    ]);
  });

  it("leaves a store with no region alone rather than guessing", () => {
    assert.deepEqual(nearbyStoreIds({ storeId: "nyöppnad", stores: STORES, pairs: [] }), []);
  });

  it("never lists the store itself", () => {
    const pairs = [
      { storeId: "taby", nearbyStoreId: "taby" },
      { storeId: "taby", nearbyStoreId: "linkoping" },
    ];
    assert.deepEqual(nearbyStoreIds({ storeId: "taby", stores: STORES, pairs }), ["linkoping"]);
  });

  it("stops using the region as soon as any pair exists anywhere", () => {
    // Täby and Kungsholmen share a region, but an admin has started deciding
    // and has not linked them. Falling back per store would silently re-open
    // the whole region, which is the wrong way round for this setting.
    const pairs = [
      { storeId: "linkoping", nearbyStoreId: "orebro" },
      { storeId: "orebro", nearbyStoreId: "linkoping" },
    ];
    assert.equal(nearbyIsFromRegion(pairs), false);
    assert.deepEqual(nearbyStoreIds({ storeId: "taby", stores: STORES, pairs }), []);
    assert.deepEqual(nearbyStoreIds({ storeId: "linkoping", stores: STORES, pairs }), ["orebro"]);
  });
});

describe("who shows up as free", () => {
  const candidates = [
    employee({ employeeId: "anna", homeStoreId: "kungsholmen", name: "Anna" }),
    employee({ employeeId: "bo", homeStoreId: "kungsholmen", name: "Bo" }),
    employee({ employeeId: "cia", homeStoreId: "linkoping", name: "Cia" }),
  ];

  const base = {
    requestingStoreId: "taby",
    date: "2026-11-07",
    candidates,
    visibleStoreIds: ["kungsholmen"],
  };

  it("lists the nearby store's free staff and nobody else's", () => {
    const rows = availableFor({ ...base, shiftsThatDay: [] });
    assert.deepEqual(
      rows.map((row) => row.name),
      ["Anna", "Bo"],
      "Cia is in another region and must not appear"
    );
  });

  it("shows the minimum and nothing more", () => {
    const [row] = availableFor({ ...base, shiftsThatDay: [] });
    assert.deepEqual(Object.keys(row).sort(), [
      "alreadyAsked",
      "employeeId",
      "homeStoreName",
      "name",
    ]);
  });

  it("drops anyone working that day, without saying when or where", () => {
    const rows = availableFor({
      ...base,
      shiftsThatDay: [{ employeeId: "anna", startsAt: "10:00", endsAt: "18:00" }],
    });
    assert.deepEqual(
      rows.map((row) => row.name),
      ["Bo"]
    );
    assert.equal(
      JSON.stringify(rows).includes("10:00"),
      false,
      "the other store's hours must not leak into the result"
    );
  });

  it("keeps somebody whose shift misses the asked-for window", () => {
    const morning = [{ employeeId: "anna", startsAt: "07:00", endsAt: "12:00" }];

    const whole = availableFor({ ...base, shiftsThatDay: morning });
    assert.deepEqual(whole.map((row) => row.name), ["Bo"], "no times asked means the whole day");

    const evening = availableFor({
      ...base,
      startsAt: "16:00",
      endsAt: "20:00",
      shiftsThatDay: morning,
    });
    assert.deepEqual(evening.map((row) => row.name), ["Anna", "Bo"]);

    const touching = availableFor({
      ...base,
      startsAt: "12:00",
      endsAt: "20:00",
      shiftsThatDay: morning,
    });
    assert.equal(touching.length, 2, "a shift ending as the next begins is not a clash");
  });

  it("respects consent, which is off by default", () => {
    const rows = availableFor({
      ...base,
      candidates: [
        employee({ employeeId: "anna", homeStoreId: "kungsholmen", name: "Anna", openToExtraShifts: false }),
        employee({ employeeId: "bo", homeStoreId: "kungsholmen", name: "Bo" }),
      ],
      shiftsThatDay: [],
    });
    assert.deepEqual(rows.map((row) => row.name), ["Bo"]);
  });

  it("leaves out inactive people and the asking store's own staff", () => {
    const rows = availableFor({
      ...base,
      candidates: [
        employee({ employeeId: "anna", homeStoreId: "kungsholmen", name: "Anna", active: false }),
        employee({ employeeId: "dan", homeStoreId: "taby", name: "Dan" }),
      ],
      visibleStoreIds: ["kungsholmen", "taby"],
      shiftsThatDay: [],
    });
    assert.deepEqual(rows, [], "own staff are scheduled directly, not borrowed");
  });

  it("marks somebody we have already asked about that day", () => {
    const rows = availableFor({
      ...base,
      shiftsThatDay: [],
      pendingRequests: [
        { employeeId: "anna", date: "2026-11-07" },
        { employeeId: "bo", date: "2026-11-08" },
      ],
    });
    assert.deepEqual(
      rows.map((row) => [row.name, row.alreadyAsked]),
      [
        ["Anna", true],
        ["Bo", false],
      ]
    );
  });

  it("returns nothing when the store can see nowhere", () => {
    assert.deepEqual(availableFor({ ...base, visibleStoreIds: [], shiftsThatDay: [] }), []);
  });
});
