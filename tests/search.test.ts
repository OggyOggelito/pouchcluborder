import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fold, groupHits, rank, scoreFields, scoreMatch, type SearchHit } from "../src/lib/search";
import { TERMS, countOf, termFor } from "../src/lib/terms";

describe("search matching", () => {
  it("ignores case and Swedish diacritics", () => {
    assert.equal(fold("Göteborgs Rapé"), "goteborgs rape");
    assert.notEqual(scoreMatch("Göteborgs Rapé", "rape"), null);
    assert.notEqual(scoreMatch("Skruf Fresh", "SKRUF"), null);
  });

  it("returns null when there is no match at all", () => {
    assert.equal(scoreMatch("Zyn Cool Mint", "velo"), null);
    assert.equal(scoreMatch("anything", ""), null);
  });

  it("ranks a prefix above a word start above a mid-word match", () => {
    const prefix = scoreMatch("Zyn Cool Mint", "zy")!;
    const wordStart = scoreMatch("Cool Zyn", "zy")!;
    const midWord = scoreMatch("Crazyn", "zy")!;

    assert.ok(prefix < wordStart, "a prefix should win");
    assert.ok(wordStart < midWord, "a word start should beat a mid-word match");
  });

  it("breaks ties on length, so the shortest match comes first", () => {
    const short = scoreMatch("Loop", "loop")!;
    const long = scoreMatch("Loop Jalapeño Mango Extra Strong", "loop")!;
    assert.ok(short < long);
  });

  it("takes the best score across several fields", () => {
    const best = scoreFields(["Mint something", "Zyn"], "zyn");
    const only = scoreMatch("Zyn", "zyn");
    assert.equal(best, only);
    assert.equal(scoreFields([null, undefined, ""], "zyn"), null);
  });
});

describe("ranking and grouping", () => {
  it("sorts by score and honours the limit", () => {
    const scored = [
      { score: 3, value: "third" },
      { score: 1, value: "first" },
      { score: 2, value: "second" },
    ];
    assert.deepEqual(rank(scored, 2), ["first", "second"]);
  });

  it("keeps the configured group order and drops empty groups", () => {
    const hits: SearchHit[] = [
      { group: "page", href: "/news", title: "Nyheter" },
      { group: "product", href: "/staff/finder", title: "Zyn Cool Mint" },
    ];
    assert.deepEqual(
      groupHits(hits).map((section) => section.group),
      ["product", "page"]
    );
    assert.equal(groupHits([]).length, 0);
  });
});

describe("the glossary", () => {
  it("gives both Swedish forms, because the plural is not regular", () => {
    assert.equal(TERMS.stock.one, "stock");
    assert.equal(TERMS.stock.many, "stockar");
    assert.equal(TERMS.can.one, "dosa");
    assert.equal(TERMS.can.many, "dosor");
  });

  it("agrees the count with the noun", () => {
    assert.equal(countOf("stock", 1), "1 stock");
    assert.equal(countOf("stock", 2), "2 stockar");
    assert.equal(countOf("stock", 0), "0 stockar");
    assert.equal(termFor("can", 1), "dosa");
    assert.equal(termFor("can", 3), "dosor");
  });

  it("explains every term in a sentence a new employee could use", () => {
    for (const term of Object.values(TERMS)) {
      assert.ok(term.explanation.length > 20, `${term.one} needs a real explanation`);
      assert.ok(term.explanation.endsWith("."), `${term.one} should be a sentence`);
    }
  });
});
