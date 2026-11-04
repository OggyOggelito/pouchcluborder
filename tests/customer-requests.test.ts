import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_TEXT_LENGTH,
  REQUEST_KINDS,
  REQUEST_STATUSES,
  clampText,
  dedupKey,
  keyForProduct,
  normalizeKey,
  toRequestKind,
  toRequestStatus,
} from "../src/lib/customer-requests";

describe("request deduplication", () => {
  it("collapses case, diacritics and whitespace to one key", () => {
    const expected = "zyncoolmint";
    for (const [brand, flavor] of [
      ["Zyn", "Cool Mint"],
      ["zyn", "cool mint"],
      ["ZYN", "COOL MINT"],
      ["  Zyn  ", "  Cool   Mint "],
      ["Zyn", "Cöol Mint"],
    ] as [string, string][]) {
      assert.equal(normalizeKey(brand, flavor), expected, `${brand} / ${flavor}`);
    }
  });

  it("folds Swedish characters so å, ä and ö do not split a request", () => {
    assert.equal(normalizeKey("Göteborgs Rapé", "Lössnus"), normalizeKey("goteborgs rape", "lossnus"));
    assert.equal(normalizeKey("Blåbär", null), "blabar");
  });

  it("ignores punctuation and separator differences", () => {
    // "G.3" and "G3" are the same brand; "Extra-Strong" and "Extra Strong" the
    // same strength. Both have to collapse together.
    assert.equal(normalizeKey("G.3", "Extra-Strong"), normalizeKey("G3", "Extra Strong"));
    assert.equal(normalizeKey("White Fox", null), normalizeKey("white-fox", null));
    assert.equal(normalizeKey("on!", null), normalizeKey("ON", null));
  });

  it("handles a missing brand or flavour", () => {
    assert.equal(normalizeKey("Zyn", null), "zyn");
    assert.equal(normalizeKey(null, "Cool Mint"), "coolmint");
    assert.equal(normalizeKey(null, null), "");
  });

  it("keys an out-of-stock request on the product, not the typed text", () => {
    // Two people typing the same sold-out product differently must still land
    // on one row.
    const a = dedupKey({ kind: "OUT_OF_STOCK", productId: "prod-1", brandText: "Zyn", flavorText: "Cool Mint" });
    const b = dedupKey({ kind: "OUT_OF_STOCK", productId: "prod-1", brandText: "ZYN cool-mint", flavorText: null });
    assert.equal(a, b);
    assert.equal(a, keyForProduct("prod-1"));
  });

  it("keys a free-text request on the normalised text", () => {
    assert.equal(
      dedupKey({ kind: "NOT_STOCKED", brandText: "Nordic Spirit", flavorText: "Mint" }),
      "nordicspiritmint"
    );
  });

  it("keeps different products apart", () => {
    assert.notEqual(keyForProduct("prod-1"), keyForProduct("prod-2"));
    assert.notEqual(normalizeKey("Zyn", "Cool Mint"), normalizeKey("Zyn", "Citrus"));
  });
});

describe("request text limits", () => {
  it("caps free text at the documented length", () => {
    const long = "a".repeat(500);
    assert.equal(clampText(long)?.length, MAX_TEXT_LENGTH);
  });

  it("trims and collapses, and treats blank as nothing", () => {
    assert.equal(clampText("  Zyn   Cool  "), "Zyn Cool");
    assert.equal(clampText("   "), null);
    assert.equal(clampText(null), null);
  });
});

describe("request enums", () => {
  it("falls back to safe defaults for unknown values", () => {
    assert.equal(toRequestKind("NONSENSE"), "NOT_STOCKED");
    assert.equal(toRequestStatus("NONSENSE"), "NEW");
    for (const kind of REQUEST_KINDS) assert.equal(toRequestKind(kind), kind);
    for (const status of REQUEST_STATUSES) assert.equal(toRequestStatus(status), status);
  });
});
