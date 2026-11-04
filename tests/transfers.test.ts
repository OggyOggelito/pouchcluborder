import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALLOWED_TRANSITIONS,
  TRANSFER_STATUSES,
  canTransition,
  eligibleAccepterIds,
  isTerminal,
  nextActor,
  toTransferUnit,
} from "../src/lib/transfers";

describe("transfer status transitions", () => {
  it("allows only the documented moves", () => {
    assert.ok(canTransition("REQUESTED", "ACCEPTED"));
    assert.ok(canTransition("REQUESTED", "DECLINED"));
    assert.ok(canTransition("REQUESTED", "CANCELLED"));
    assert.ok(canTransition("ACCEPTED", "SENT"));
    assert.ok(canTransition("SENT", "RECEIVED"));
  });

  it("refuses to move a transfer backwards", () => {
    assert.ok(!canTransition("SENT", "ACCEPTED"));
    assert.ok(!canTransition("RECEIVED", "SENT"));
    assert.ok(!canTransition("ACCEPTED", "REQUESTED"));
  });

  it("refuses to skip a step", () => {
    assert.ok(!canTransition("REQUESTED", "SENT"));
    assert.ok(!canTransition("REQUESTED", "RECEIVED"));
    assert.ok(!canTransition("ACCEPTED", "RECEIVED"));
  });

  it("treats RECEIVED, DECLINED and CANCELLED as final", () => {
    for (const status of ["RECEIVED", "DECLINED", "CANCELLED"] as const) {
      assert.ok(isTerminal(status), `${status} should be terminal`);
      for (const target of TRANSFER_STATUSES) {
        assert.ok(!canTransition(status, target), `${status} -> ${target} should be refused`);
      }
    }
  });

  it("never allows a transition to itself", () => {
    for (const status of TRANSFER_STATUSES) {
      assert.ok(!canTransition(status, status), `${status} -> ${status}`);
    }
  });

  it("only ever names real statuses as targets", () => {
    for (const targets of Object.values(ALLOWED_TRANSITIONS)) {
      for (const target of targets) {
        assert.ok(TRANSFER_STATUSES.includes(target), `unknown status ${target}`);
      }
    }
  });

  it("says which side acts next", () => {
    assert.equal(nextActor("REQUESTED"), "SENDER");
    assert.equal(nextActor("ACCEPTED"), "SENDER");
    assert.equal(nextActor("SENT"), "REQUESTER");
    assert.equal(nextActor("RECEIVED"), "NOBODY");
    assert.equal(nextActor("DECLINED"), "NOBODY");
  });

  it("stores the unit explicitly rather than assuming", () => {
    assert.equal(toTransferUnit("CAN"), "CAN");
    assert.equal(toTransferUnit("STOCK"), "STOCK");
    // Anything unrecognised falls back to the larger, explicit default.
    assert.equal(toTransferUnit(undefined), "STOCK");
    assert.equal(toTransferUnit("boxes"), "STOCK");
  });
});

describe("who may accept a transfer (permission scoping)", () => {
  const stores = [
    { id: "taby", region: "Stockholm" },
    { id: "vastermalm", region: "Stockholm" },
    { id: "hornsgatan", region: "Stockholm" },
    { id: "linkoping", region: "Öst" },
    { id: "orebro", region: "Mitt" },
    { id: "unassigned", region: null },
  ];

  it("offers an open request to the rest of the region only", () => {
    const eligible = eligibleAccepterIds({
      requestingStoreId: "taby",
      targetStoreId: null,
      requestingRegion: "Stockholm",
      stores,
    });
    assert.deepEqual(eligible.sort(), ["hornsgatan", "vastermalm"]);
  });

  it("never offers a request back to the store that made it", () => {
    const eligible = eligibleAccepterIds({
      requestingStoreId: "taby",
      targetStoreId: null,
      requestingRegion: "Stockholm",
      stores,
    });
    assert.ok(!eligible.includes("taby"));
  });

  it("never reaches another region on an open request", () => {
    const eligible = eligibleAccepterIds({
      requestingStoreId: "taby",
      targetStoreId: null,
      requestingRegion: "Stockholm",
      stores,
    });
    for (const outside of ["linkoping", "orebro", "unassigned"]) {
      assert.ok(!eligible.includes(outside), `${outside} should not be eligible`);
    }
  });

  it("restricts a targeted request to exactly that store, across regions", () => {
    // An admin may target outside the region; only that store may accept.
    const eligible = eligibleAccepterIds({
      requestingStoreId: "taby",
      targetStoreId: "orebro",
      requestingRegion: "Stockholm",
      stores,
    });
    assert.deepEqual(eligible, ["orebro"]);
  });

  it("offers nothing when the region has no other store", () => {
    const eligible = eligibleAccepterIds({
      requestingStoreId: "linkoping",
      targetStoreId: null,
      requestingRegion: "Öst",
      stores,
    });
    assert.deepEqual(eligible, []);
  });

  it("offers nothing when the requesting store has no region", () => {
    const eligible = eligibleAccepterIds({
      requestingStoreId: "unassigned",
      targetStoreId: null,
      requestingRegion: null,
      stores,
    });
    assert.deepEqual(eligible, []);
  });
});
