import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { articleSlug, filterArticles } from "../src/lib/knowledge";

const ARTICLES = [
  { id: "a", title: "Stängning", body: "Räkna kassan och lås bakdörren.", category: "Kassa" },
  { id: "b", title: "Öppning", body: "Tänd i butiken och starta kassan.", category: "Kassa" },
  { id: "c", title: "Beställa varor", body: "Gå till startsidan och välj butik.", category: "Inköp" },
  { id: "d", title: "Utan kategori", body: "Något annat.", category: null },
];

describe("routine search", () => {
  it("returns everything when nothing is filtered", () => {
    assert.equal(filterArticles(ARTICLES, {}).length, 4);
    assert.equal(filterArticles(ARTICLES, { category: null, query: "" }).length, 4);
    assert.equal(filterArticles(ARTICLES, { category: "  ", query: "  " }).length, 4);
  });

  it("narrows to one category", () => {
    assert.deepEqual(
      filterArticles(ARTICLES, { category: "Kassa" }).map((row) => row.id),
      ["a", "b"]
    );
  });

  it("matches the title", () => {
    assert.deepEqual(
      filterArticles(ARTICLES, { query: "stängning" }).map((row) => row.id),
      ["a"]
    );
  });

  it("matches the body, so a word three paragraphs down still finds the article", () => {
    assert.deepEqual(
      filterArticles(ARTICLES, { query: "bakdörren" }).map((row) => row.id),
      ["a"]
    );
  });

  it("ignores case and Swedish diacritics", () => {
    // Someone typing on a phone keyboard writes "oppning", not "Öppning".
    assert.deepEqual(filterArticles(ARTICLES, { query: "OPPNING" }).map((r) => r.id), ["b"]);
    assert.deepEqual(filterArticles(ARTICLES, { query: "stangning" }).map((r) => r.id), ["a"]);
  });

  it("combines a category chip with a search", () => {
    assert.deepEqual(
      filterArticles(ARTICLES, { category: "Kassa", query: "kassan" }).map((row) => row.id),
      ["a", "b"]
    );
    assert.deepEqual(
      filterArticles(ARTICLES, { category: "Inköp", query: "kassan" }).map((row) => row.id),
      []
    );
  });

  it("finds uncategorised articles when no chip is active, and never under a chip", () => {
    assert.ok(filterArticles(ARTICLES, { query: "annat" }).some((row) => row.id === "d"));
    assert.equal(filterArticles(ARTICLES, { category: "Kassa", query: "annat" }).length, 0);
  });
});

describe("article slugs", () => {
  it("folds Swedish letters rather than dropping them", () => {
    assert.equal(articleSlug("Stängning"), "stangning");
    assert.equal(articleSlug("Öppning av butiken"), "oppning-av-butiken");
  });

  it("handles the seeded example title", () => {
    assert.equal(articleSlug("EXEMPEL – ta bort"), "exempel-ta-bort");
  });

  it("never returns an empty slug", () => {
    assert.equal(articleSlug("!!!"), "artikel");
    assert.equal(articleSlug(""), "artikel");
  });
});
