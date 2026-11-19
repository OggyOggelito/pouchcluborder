import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CANCEL_CUTOFF_DAYS,
  MAX_AHEAD_DAYS,
  MIN_LEAD_DAYS,
  bookableRange,
  bookableStores,
  canSupplierCancel,
  canTransition,
  checkRequestDate,
  holdsSlot,
  storeOptionsFor,
  toDemoStatus,
} from "../src/lib/demo-days";
import { MIN_PASSWORD_LENGTH, validatePassword } from "../src/lib/passwords";
import { SIGN_IN_RULE, clearAll, consume, describeRetry, reset } from "../src/lib/rate-limit";

describe("when a demo day may be asked for", () => {
  const today = "2026-11-19";

  it("needs notice, because a demo day is somebody's rota", () => {
    assert.equal(checkRequestDate("2026-11-20", today).ok, false);
    assert.equal(checkRequestDate("2026-11-25", today).ok, false, `${MIN_LEAD_DAYS} days`);
    assert.equal(checkRequestDate("2026-11-26", today).ok, true);
  });

  it("will not book the past", () => {
    assert.equal(checkRequestDate("2026-11-18", today).ok, false);
  });

  it("stops at the far end too", () => {
    assert.equal(checkRequestDate("2027-01-18", today).ok, true);
    assert.equal(checkRequestDate("2027-01-19", today).ok, false, `${MAX_AHEAD_DAYS} days`);
  });

  it("refuses anything that is not a date", () => {
    assert.equal(checkRequestDate("snart", today).ok, false);
    assert.equal(checkRequestDate("2026-02-30", today).ok, false);
  });

  it("offers the same window to the date picker", () => {
    assert.deepEqual(bookableRange(today), { from: "2026-11-26", to: "2027-01-18" });
  });
});

describe("which stores can be picked", () => {
  const base = {
    storeId: "a",
    storeName: "Butik A",
    closed: false,
    hoursMissing: false,
    opensAt: "10:00",
    closesAt: "18:00",
    taken: false,
  };

  it("says why, without saying who", () => {
    const [option] = storeOptionsFor({ stores: [{ ...base, taken: true }] });
    assert.equal(option.blockedReason, "Redan bokad");
    // Deliberately not "Redan bokad av Loop": one supplier must not learn
    // what another is doing from a disabled checkbox.
    assert.ok(!/av /.test(option.blockedReason ?? ""));
  });

  it("tells a closed day apart from one with no hours entered", () => {
    const [closed] = storeOptionsFor({ stores: [{ ...base, closed: true }] });
    assert.equal(closed.blockedReason, "Stängt den dagen");

    const [missing] = storeOptionsFor({ stores: [{ ...base, hoursMissing: true }] });
    assert.equal(missing.blockedReason, "Öppettider saknas");
  });

  it("puts 'redan bokad' first when a store is both taken and shut", () => {
    const [option] = storeOptionsFor({ stores: [{ ...base, closed: true, taken: true }] });
    assert.equal(option.blockedReason, "Redan bokad");
  });

  it("offers only the ones with no reason not to", () => {
    const options = storeOptionsFor({
      stores: [base, { ...base, storeId: "b", storeName: "Butik B", taken: true }],
    });
    assert.deepEqual(bookableStores(options).map((option) => option.storeId), ["a"]);
  });
});

describe("statuses", () => {
  it("counts only a live booking as holding the day", () => {
    assert.equal(holdsSlot("REQUESTED"), true);
    assert.equal(holdsSlot("CONFIRMED"), true);
    for (const status of ["DECLINED", "CANCELLED_BY_SUPPLIER", "CANCELLED_BY_STORE"] as const) {
      assert.equal(holdsSlot(status), false, `${status} frees the day`);
    }
  });

  it("allows a confirmed day to still fall through, on either side", () => {
    assert.equal(canTransition("CONFIRMED", "CANCELLED_BY_SUPPLIER"), true);
    assert.equal(canTransition("CONFIRMED", "CANCELLED_BY_STORE"), true);
    assert.equal(canTransition("CONFIRMED", "DECLINED"), false);
  });

  it("treats the three end states as final", () => {
    for (const status of ["DECLINED", "CANCELLED_BY_SUPPLIER", "CANCELLED_BY_STORE"] as const) {
      assert.equal(canTransition(status, "CONFIRMED"), false);
    }
  });

  it("falls back to REQUESTED for anything unrecognised", () => {
    assert.equal(toDemoStatus("MAYBE"), "REQUESTED");
    assert.equal(toDemoStatus("CONFIRMED"), "CONFIRMED");
  });
});

describe("cancelling", () => {
  const today = "2026-11-19";

  it("is open until the cut-off", () => {
    assert.equal(
      canSupplierCancel({ status: "CONFIRMED", date: "2026-11-22", today }),
      true,
      `${CANCEL_CUTOFF_DAYS} days out`
    );
    assert.equal(canSupplierCancel({ status: "CONFIRMED", date: "2026-11-21", today }), false);
  });

  it("is not offered for a booking that is already over", () => {
    assert.equal(canSupplierCancel({ status: "DECLINED", date: "2026-12-24", today }), false);
  });
});

describe("passwords", () => {
  it("asks for length and nothing else", () => {
    assert.equal(validatePassword("x".repeat(MIN_PASSWORD_LENGTH)), null);
    assert.ok(validatePassword("kort"));
    // No "one capital, one digit, one symbol": those rules push people
    // towards Sommar2026! and are not what current guidance asks for.
    assert.equal(validatePassword("en mening jag minns"), null);
  });

  it("will not take blanks", () => {
    assert.ok(validatePassword(" ".repeat(MIN_PASSWORD_LENGTH + 2)));
  });
});

describe("the sign-in rate limiter", () => {
  it("allows the first attempts and then stops", () => {
    clearAll();
    const key = "test|1.2.3.4|a@example.test";

    for (let attempt = 0; attempt < SIGN_IN_RULE.limit; attempt += 1) {
      assert.equal(consume(key, SIGN_IN_RULE, 1000).allowed, true, `attempt ${attempt + 1}`);
    }
    const blocked = consume(key, SIGN_IN_RULE, 1000);
    assert.equal(blocked.allowed, false);
    assert.ok(!blocked.allowed && blocked.retryAfterMs > 0);
  });

  it("opens again when the window passes", () => {
    clearAll();
    const key = "test|window";
    for (let attempt = 0; attempt < SIGN_IN_RULE.limit; attempt += 1) {
      consume(key, SIGN_IN_RULE, 1000);
    }
    assert.equal(consume(key, SIGN_IN_RULE, 1000).allowed, false);
    assert.equal(
      consume(key, SIGN_IN_RULE, 1000 + SIGN_IN_RULE.windowMs + 1).allowed,
      true
    );
  });

  it("counts each address separately", () => {
    clearAll();
    for (let attempt = 0; attempt < SIGN_IN_RULE.limit; attempt += 1) {
      consume("a", SIGN_IN_RULE, 1000);
    }
    assert.equal(consume("a", SIGN_IN_RULE, 1000).allowed, false);
    assert.equal(consume("b", SIGN_IN_RULE, 1000).allowed, true);
  });

  it("forgets a key after a successful sign-in", () => {
    clearAll();
    for (let attempt = 0; attempt < SIGN_IN_RULE.limit; attempt += 1) {
      consume("c", SIGN_IN_RULE, 1000);
    }
    reset("c");
    assert.equal(consume("c", SIGN_IN_RULE, 1000).allowed, true);
  });

  it("says when to come back, in Swedish", () => {
    assert.equal(describeRetry(30_000), "om en minut");
    assert.equal(describeRetry(10 * 60_000), "om 10 minuter");
  });
});
