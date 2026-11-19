import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  describePause,
  describeScheduled,
  isActive,
  isScheduled,
  pausesFor,
  toPauseScope,
  validatePause,
  type PauseRow,
} from "../src/lib/order-pause";

/**
 * Pausing ordering.
 *
 * The window arithmetic is the part that will be wrong at three in the
 * morning, so it is tested against real instants either side of both Swedish
 * clock changes.
 */
function pause(overrides: Partial<PauseRow> = {}): PauseRow {
  return {
    id: "p1",
    scope: "ALL",
    storeId: null,
    brandId: null,
    storeName: null,
    brandName: null,
    startsAt: new Date("2026-11-01T00:00:00Z"),
    endsAt: null,
    liftedAt: null,
    message: "Leverantörsbyte",
    ...overrides,
  };
}

describe("when a pause is in force", () => {
  const now = new Date("2026-11-19T10:00:00Z");

  it("runs from its start until it is lifted", () => {
    assert.equal(isActive(pause(), now), true);
    assert.equal(isActive(pause({ liftedAt: new Date("2026-11-10T00:00:00Z") }), now), false);
  });

  it("has not started before it starts", () => {
    const future = pause({ startsAt: new Date("2026-12-01T00:00:00Z") });
    assert.equal(isActive(future, now), false);
    assert.equal(isScheduled(future, now), true);
  });

  it("stops at its end", () => {
    const ended = pause({ endsAt: new Date("2026-11-18T23:00:00Z") });
    assert.equal(isActive(ended, now), false);
  });

  it("is neither active nor scheduled once lifted", () => {
    const lifted = pause({
      startsAt: new Date("2026-12-01T00:00:00Z"),
      liftedAt: new Date("2026-11-15T00:00:00Z"),
    });
    assert.equal(isActive(lifted, now), false);
    assert.equal(isScheduled(lifted, now), false);
  });
});

describe("the boundary, in Europe/Stockholm", () => {
  /**
   * A pause set to end at 08:00 Swedish time must end at 08:00 Swedish time on
   * both sides of a clock change. The instants below are what 07:59 and 08:01
   * local actually are: CEST (UTC+2) in October, CET (UTC+1) after.
   */
  /** Started long before any of the instants below, so only the end is in play. */
  const running = (endsAt: Date) =>
    pause({ startsAt: new Date("2026-09-01T00:00:00Z"), endsAt });

  it("ends at the local hour before the autumn change", () => {
    const endsAt = new Date("2026-10-24T06:00:00Z"); // 08:00 CEST
    assert.equal(isActive(running(endsAt), new Date("2026-10-24T05:59:00Z")), true);
    assert.equal(isActive(running(endsAt), new Date("2026-10-24T06:01:00Z")), false);
  });

  it("and at the same local hour after it", () => {
    const endsAt = new Date("2026-10-26T07:00:00Z"); // 08:00 CET
    assert.equal(isActive(running(endsAt), new Date("2026-10-26T06:59:00Z")), true);
    assert.equal(isActive(running(endsAt), new Date("2026-10-26T07:01:00Z")), false);
  });

  it("is still one hour of real time either side of the change", () => {
    // The two ends above are 08:00 local on the Saturday and the Monday. The
    // clocks went back in between, so the same wall-clock hour is a different
    // instant — which is exactly what a Date stores and a string would not.
    const saturday = new Date("2026-10-24T06:00:00Z");
    const monday = new Date("2026-10-26T07:00:00Z");
    assert.equal((monday.getTime() - saturday.getTime()) / 3_600_000, 49, "48 h plus the hour back");
  });

  it("survives the spring change the same way", () => {
    // 2027-03-28: 02:00 CET becomes 03:00 CEST.
    const endsAt = new Date("2027-03-28T02:00:00Z");
    assert.equal(isActive(running(endsAt), new Date("2027-03-28T01:59:00Z")), true);
    assert.equal(isActive(running(endsAt), new Date("2027-03-28T02:01:00Z")), false);
  });

  it("writes the end date in Swedish local time, not UTC", () => {
    // 2026-11-30T23:30Z is already the 1st of December in Stockholm.
    const text = describePause(pause({ endsAt: new Date("2026-11-30T23:30:00Z") }));
    assert.match(text, /1 dec/);
  });
});

describe("which orders a pause stops", () => {
  const now = new Date("2026-11-19T10:00:00Z");

  it("catches everything when the scope is ALL", () => {
    const applies = pausesFor({ pauses: [pause()], storeId: "taby", now });
    assert.equal(applies.length, 1);
  });

  it("catches one shop only when the scope is STORE", () => {
    const only = pause({ scope: "STORE", storeId: "taby", storeName: "Täby Centrum" });
    assert.equal(pausesFor({ pauses: [only], storeId: "taby", now }).length, 1);
    assert.equal(pausesFor({ pauses: [only], storeId: "lkp", now }).length, 0);
  });

  it("catches a brand pause only when the basket holds that brand", () => {
    const brand = pause({ scope: "BRAND", brandId: "loop", brandName: "Loop" });

    assert.equal(
      pausesFor({ pauses: [brand], storeId: "taby", brandIds: ["loop", "xqs"], now }).length,
      1,
      "the basket contains Loop"
    );
    assert.equal(
      pausesFor({ pauses: [brand], storeId: "taby", brandIds: ["xqs"], now }).length,
      0,
      "a pause on one supplier must not stop everything else"
    );
    assert.equal(
      pausesFor({ pauses: [brand], storeId: "taby", now }).length,
      1,
      "with no basket to check, the banner still shows"
    );
  });

  it("ignores a lifted or future pause whatever its scope", () => {
    const pauses = [
      pause({ id: "a", liftedAt: new Date("2026-11-10T00:00:00Z") }),
      pause({ id: "b", startsAt: new Date("2026-12-24T00:00:00Z") }),
    ];
    assert.deepEqual(pausesFor({ pauses, storeId: "taby", now }), []);
  });
});

describe("what the banner says", () => {
  it("names the end date when there is one", () => {
    assert.equal(
      describePause(pause({ endsAt: new Date("2026-12-01T09:00:00Z") })),
      "Beställningar är pausade till 1 dec: Leverantörsbyte"
    );
  });

  it("invents no end date when there is none", () => {
    assert.equal(describePause(pause()), "Beställningar är pausade: Leverantörsbyte");
  });

  it("names the brand for a brand pause, so the rest is clearly open", () => {
    assert.match(
      describePause(pause({ scope: "BRAND", brandId: "loop", brandName: "Loop" })),
      /^Beställningar av Loop är pausade/
    );
  });

  it("words a scheduled pause as the future", () => {
    assert.match(
      describeScheduled(pause({ startsAt: new Date("2026-12-01T09:00:00Z") })),
      /^Beställningar pausas från 1 dec/
    );
  });
});

describe("what a pause must have", () => {
  const base = {
    scope: "ALL" as const,
    storeId: null,
    brandId: null,
    startsAt: new Date("2026-11-01T00:00:00Z"),
    endsAt: null,
    message: "Leverantörsbyte",
  };

  it("accepts the ordinary case", () => {
    assert.deepEqual(validatePause(base), { ok: true });
  });

  it("insists on a message, because that is all a store sees", () => {
    assert.equal(validatePause({ ...base, message: "   " }).ok, false);
    assert.equal(validatePause({ ...base, message: "x".repeat(201) }).ok, false);
  });

  it("insists on the thing a scoped pause is scoped to", () => {
    assert.equal(validatePause({ ...base, scope: "STORE" }).ok, false);
    assert.equal(validatePause({ ...base, scope: "BRAND" }).ok, false);
    assert.equal(validatePause({ ...base, scope: "STORE", storeId: "taby" }).ok, true);
  });

  it("refuses an end at or before its start", () => {
    assert.equal(
      validatePause({ ...base, endsAt: new Date("2026-11-01T00:00:00Z") }).ok,
      false
    );
    assert.equal(
      validatePause({ ...base, endsAt: new Date("2026-10-01T00:00:00Z") }).ok,
      false
    );
  });

  it("falls back to ALL for an unknown scope, which is the safe direction", () => {
    assert.equal(toPauseScope("EVERYTHING"), "ALL");
    assert.equal(toPauseScope("BRAND"), "BRAND");
  });
});
