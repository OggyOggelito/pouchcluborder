import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { flavorsMatch, foldFlavor } from "../src/lib/flavor-match";
import {
  STRENGTH_UNITS,
  isStrengthUnit,
  strengthUnitLabel,
  strengthUnitNote,
  toStrengthUnit,
} from "../src/lib/strength-units";

describe("matching a supplier flavour to ours", () => {
  it("ignores the accent the masterdoc dropped", () => {
    // Loop's deck says "Jalapeño Lime"; our catalog says "Jalapeno Lime".
    assert.ok(flavorsMatch("Jalapeño Lime", "Jalapeno Lime"));
    assert.equal(foldFlavor("Jalapeño Lime"), "jalapeno lime");
  });

  it("ignores case and stray whitespace", () => {
    assert.ok(flavorsMatch("RED CHILI MELON", "Red Chili Melon"));
    assert.ok(flavorsMatch("  Smooth   Mint ", "Smooth Mint"));
  });

  it("keeps two different flavours apart", () => {
    // Both exist in the Loop catalog; conflating them would put the wrong
    // supplier text on a real product.
    assert.ok(!flavorsMatch("Hot Mango", "Mango Chili"));
    assert.ok(!flavorsMatch("Smooth Mint", "Smooth Mint Mega"));
    assert.ok(!flavorsMatch("Ice Cool Mint", "Ice Cold"));
    assert.ok(!flavorsMatch("Blueberry Ice", "Blueberry Mint"));
  });

  it("does not try to be clever about near-misses", () => {
    assert.ok(!flavorsMatch("Fresh Peppermint", "Peppermint"));
    assert.ok(!flavorsMatch("Hot Peach", "Peach"));
  });
});

describe("strength units", () => {
  it("keeps mg/g and mg/påse apart", () => {
    assert.equal(strengthUnitLabel("MG_PER_G"), "mg/g");
    assert.equal(strengthUnitLabel("MG_PER_POUCH"), "mg/påse");
    assert.notEqual(strengthUnitLabel("MG_PER_G"), strengthUnitLabel("MG_PER_POUCH"));
  });

  it("treats an unknown unit as unknown, never as a guess", () => {
    for (const value of ["MG", "mg/g", "", null, undefined, 25]) {
      assert.equal(toStrengthUnit(value), null, `${String(value)} should not resolve to a unit`);
      assert.equal(strengthUnitLabel(value), null);
      assert.equal(strengthUnitNote(value), null);
    }
  });

  it("round-trips every real unit", () => {
    for (const unit of STRENGTH_UNITS) {
      assert.ok(isStrengthUnit(unit));
      assert.equal(toStrengthUnit(unit), unit);
      assert.ok((strengthUnitLabel(unit) ?? "").length > 0);
      assert.ok((strengthUnitNote(unit) ?? "").length > 20);
    }
  });

  it("warns, in the mg/g note, that the figure is not comparable", () => {
    const note = strengthUnitNote("MG_PER_G") ?? "";
    assert.ok(note.includes("mg/g"));
    assert.ok(note.toLowerCase().includes("per påse"));
  });
});
