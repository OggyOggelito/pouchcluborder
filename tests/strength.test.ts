import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  STRENGTH_RANGES,
  matchesRange,
  parseStrengthMg,
  rangeForMg,
  strengthMg,
} from "../src/lib/strength";

describe("strength parsing", () => {
  it("reads milligrams from the catalog's strength text", () => {
    assert.equal(parseStrengthMg("10mg"), 10);
    assert.equal(parseStrengthMg("10 mg"), 10);
    assert.equal(parseStrengthMg("10,4 mg"), 10.4);
    assert.equal(parseStrengthMg("13.5mg"), 13.5);
    assert.equal(parseStrengthMg("6"), 6);
  });

  it("returns null for strengths that carry no milligram value", () => {
    // Real values from the catalog: tier codes and word strengths.
    for (const value of ["#3", "#4", "S2", "S4", "Strong", "Extra Strong", "Regular", "", null]) {
      assert.equal(parseStrengthMg(value), null, `"${value}" should not parse`);
    }
  });

  it("prefers the supplier's numeric value over the parsed text", () => {
    assert.equal(strengthMg({ nicotineMgPerPortion: 11.2, strength: "Strong" }), 11.2);
    // and falls back when there is no numeric value
    assert.equal(strengthMg({ nicotineMgPerPortion: null, strength: "9mg" }), 9);
    assert.equal(strengthMg({ nicotineMgPerPortion: null, strength: "Strong" }), null);
  });

  it("puts each milligram value in exactly one range", () => {
    for (const mg of [0, 3, 6, 6.5, 7, 10.4, 11, 11.2, 12, 16, 17, 19.2, 80]) {
      const hits = STRENGTH_RANGES.filter((range) => matchesRange(mg, range.id));
      assert.equal(hits.length, 1, `${mg} mg matched ${hits.length} ranges`);
    }
  });

  it("maps the boundaries the way the labels read", () => {
    assert.equal(rangeForMg(6), "0-6");
    assert.equal(rangeForMg(6.5), "7-11"); // between the labels, lands in the upper one
    assert.equal(rangeForMg(11), "7-11");
    assert.equal(rangeForMg(11.2), "12-16");
    assert.equal(rangeForMg(16), "12-16");
    assert.equal(rangeForMg(17), "17+");
    assert.equal(rangeForMg(19.2), "17+");
    assert.equal(rangeForMg(null), null);
  });

  it("never matches a range when the strength is unknown", () => {
    for (const range of STRENGTH_RANGES) {
      assert.equal(matchesRange(null, range.id), false);
    }
  });
});
