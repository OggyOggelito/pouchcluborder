import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FLAVOR_GROUPS,
  foldFlavor,
  parseTags,
  serializeTags,
  tagsForFlavor,
  type FlavorGroup,
} from "../src/lib/flavor-tags";

/** Every name below is a real flavour from the Pouch Club catalog. */
const CASES: { flavor: string; expect: FlavorGroup[] }[] = [
  // mint / menthol
  { flavor: "Cool Mint", expect: ["mint"] },
  { flavor: "Bright Peppermint", expect: ["mint"] },
  { flavor: "Freeze Mint", expect: ["mint"] },
  { flavor: "Arctic Freeze", expect: ["mint"] },
  { flavor: "Wintergreen", expect: ["mint"] },
  { flavor: "The Menthol", expect: ["mint"] },
  { flavor: "Black Ice Spearmint", expect: ["mint"] },
  // berry
  { flavor: "Blueberry", expect: ["berry"] },
  { flavor: "Hallonsoda", expect: ["berry", "cola"] },
  { flavor: "Blackcurrant", expect: ["berry"] },
  { flavor: "Strawberry Kiwi", expect: ["berry", "fruit"] },
  { flavor: "Blue Raspberry", expect: ["berry"] },
  { flavor: "Acai", expect: ["berry"] },
  { flavor: "Forest Berries", expect: ["berry"] },
  // fruit
  { flavor: "Twin Apple", expect: ["fruit"] },
  { flavor: "Apple Crisp", expect: ["fruit"] },
  { flavor: "Black Peach", expect: ["fruit"] },
  { flavor: "Honey Melon", expect: ["fruit", "sweet"] },
  { flavor: "Black Watermelon", expect: ["fruit"] },
  { flavor: "Dark Banana", expect: ["fruit"] },
  { flavor: "Black Grape", expect: ["fruit"] },
  // citrus
  { flavor: "Orange Squeeze", expect: ["citrus"] },
  { flavor: "Cactus Lime", expect: ["citrus"] },
  { flavor: "Arctic Grapefruit", expect: ["citrus", "mint"] },
  { flavor: "Apelsin", expect: ["citrus"] },
  // tropical
  { flavor: "Black Mango", expect: ["tropical"] },
  { flavor: "Black Pineapple", expect: ["tropical"] },
  // Not a cola — that tag only ever came from "cola" sitting inside "Colada".
  { flavor: "Pina Colada", expect: ["tropical"] },
  { flavor: "Black Tropical Fruit", expect: ["tropical", "fruit"] },
  // cola / soda
  { flavor: "Black Cola", expect: ["cola"] },
  { flavor: "Blue Mojito", expect: ["cola"] },
  { flavor: "Blue Razz Lemonade", expect: ["berry", "citrus", "cola"] },
  { flavor: "Soda Crush", expect: ["cola"] },
  // liquorice
  { flavor: "Hallon Lakrits", expect: ["berry", "liquorice"] },
  { flavor: "Black Licorice", expect: ["liquorice"] },
  { flavor: "Liqorice", expect: ["liquorice"] },
  // sweet / dessert / coffee
  { flavor: "Cappuccino", expect: ["sweet"] },
  { flavor: "Banana Toffee", expect: ["fruit", "sweet"] },
  { flavor: "Caramel", expect: ["sweet"] },
  { flavor: "Vanilla Latte", expect: ["sweet"] },
  { flavor: "Bubble Gum", expect: ["sweet"] },
  { flavor: "Americano", expect: ["sweet"] },
];

describe("flavour tagging", () => {
  it(`tags ${CASES.length} real catalog flavours correctly`, () => {
    for (const { flavor, expect } of CASES) {
      const actual = tagsForFlavor(flavor).sort();
      assert.deepEqual(actual, [...expect].sort(), `"${flavor}" -> ${actual.join(",") || "(none)"}`);
    }
  });

  it("returns no tags rather than guessing a fallback group", () => {
    // These are real catalog values that are not flavours at all: formats,
    // weights and product-line names. They belong in the admin list, not in a
    // group picked at random.
    for (const flavor of ["Original", "Vit", "20g", "Portion", "Aftonglöd", "Megacan", ""]) {
      assert.deepEqual(tagsForFlavor(flavor), [], `"${flavor}" should be untagged`);
    }
  });

  it("does not fire a short keyword inside a longer word", () => {
    // "ice" is a substring of "juice" — the bug this guards against.
    assert.deepEqual(tagsForFlavor("Black Apple Juice"), ["fruit"]);
    assert.ok(!tagsForFlavor("Black Apple Juice").includes("mint"));
    // "one" inside "lemonade", "pop" inside "popcorn".
    assert.ok(!tagsForFlavor("Lemonade").includes("sweet"));
  });

  it("keeps compound words out of the wrong group", () => {
    // "körsbär" ends in "bär" but is a stone fruit.
    assert.deepEqual(tagsForFlavor("Körsbär"), ["fruit"]);
    assert.deepEqual(tagsForFlavor("Cherry"), ["fruit"]);
    // while a real berry compound still reads as a berry
    assert.ok(tagsForFlavor("Blåbär").includes("berry"));
  });

  it("folds case and Swedish diacritics", () => {
    assert.equal(foldFlavor("Blåbär Mynta"), "blabar mynta");
    assert.deepEqual(tagsForFlavor("BLÅBÄR"), tagsForFlavor("blabar"));
  });

  it("round-trips through the stored string form", () => {
    const tags = tagsForFlavor("Blueberry Mint");
    assert.deepEqual(parseTags(serializeTags(tags)).sort(), tags.sort());
    assert.equal(serializeTags([]), null);
    assert.deepEqual(parseTags(null), []);
    // Unknown values in the column are dropped rather than trusted.
    assert.deepEqual(parseTags("berry,nonsense,mint").sort(), ["berry", "mint"]);
  });

  it("only ever returns known groups", () => {
    for (const { flavor } of CASES) {
      for (const tag of tagsForFlavor(flavor)) {
        assert.ok((FLAVOR_GROUPS as readonly string[]).includes(tag), `unknown group ${tag}`);
      }
    }
  });
});
