/**
 * Brand dictionary.
 *
 * The supplier masterdoc has no brand column — `Fabr./Repr.` is a distributor
 * code (LUNA, SMD, ECIGG...), not a retail brand — so the brand has to be read
 * off the front of `Benämning`. Matching is longest-prefix-first, which is what
 * keeps "Nordic Spirit" from being read as "Nordic" and "Siberia-80" from being
 * read as "Siberia".
 *
 * `canonical` is the spelling shown in the app; `prefixes` are the spellings
 * seen in the source file (matched case-insensitively). Anything not listed here
 * still imports, but is flagged needs_review so it can be checked by hand.
 */
export type BrandEntry = {
  canonical: string;
  prefixes: string[];
};

export const BRANDS: BrandEntry[] = [
  // Multi-word brands must be listed with their full prefix.
  { canonical: "Nordic Spirit", prefixes: ["nordic spirit"] },
  { canonical: "White Fox", prefixes: ["white fox"] },
  { canonical: "Kelly White", prefixes: ["kelly white"] },
  { canonical: "Nick & Johnny", prefixes: ["nick & johnny", "nick and johnny"] },
  { canonical: "Frunk Bar", prefixes: ["frunk bar", "frunk"] },
  { canonical: "N One", prefixes: ["n one"] },
  { canonical: "Knox Karaktär", prefixes: ["knox karaktär", "knox karaktar", "knox"] },
  { canonical: "Göteborgs Rapé", prefixes: ["göteborgs rapé", "göteborgs rape"] },
  { canonical: "Göteborgs Prima Fint", prefixes: ["göteborgs prima fint"] },
  { canonical: "Smålands Brukssnus", prefixes: ["smålands brukssnus", "smålands"] },
  { canonical: "Islay Whisky", prefixes: ["islay whisky", "islay whiscy", "islay"] },
  { canonical: "La Morenita", prefixes: ["la morenita"] },
  { canonical: "Olde Ving", prefixes: ["olde ving"] },
  { canonical: "The Lab", prefixes: ["the lab"] },
  { canonical: "Lenny's Cut", prefixes: ["lenny's cut", "lennys cut", "lenny's", "lennys"] },
  { canonical: "Röda Lacket", prefixes: ["röda lacket"] },
  { canonical: "Tre Ankare", prefixes: ["tre ankare"] },
  { canonical: "Siberia-80", prefixes: ["siberia-80"] },
  { canonical: "X-Booster", prefixes: ["x-booster"] },

  // Single-token brands. Canonical spelling wins over the source's casing
  // (the file mixes ZYN/Zyn, FUMi/FUMI, skruf/Skruf).
  { canonical: "77", prefixes: ["77"] },
  { canonical: "Après", prefixes: ["après", "aprés", "apres"] },
  { canonical: "BAOW", prefixes: ["baow"] },
  { canonical: "Björn", prefixes: ["björn"] },
  { canonical: "Cafero", prefixes: ["cafero"] },
  { canonical: "Catch", prefixes: ["catch"] },
  { canonical: "Cuba", prefixes: ["cuba"] },
  { canonical: "Denssi", prefixes: ["denssi"] },
  { canonical: "Dunc", prefixes: ["dunc"] },
  { canonical: "Ettan", prefixes: ["ettan"] },
  { canonical: "Fumi", prefixes: ["fumi"] },
  { canonical: "G.3", prefixes: ["g.3"] },
  { canonical: "General", prefixes: ["general"] },
  { canonical: "Greatest", prefixes: ["greatest"] },
  { canonical: "Grov", prefixes: ["grov"] },
  { canonical: "Helwit", prefixes: ["helwit"] },
  { canonical: "HIT", prefixes: ["hit"] },
  { canonical: "ICE", prefixes: ["ice"] },
  { canonical: "Kaliber", prefixes: ["kaliber"] },
  { canonical: "Kapten", prefixes: ["kapten"] },
  { canonical: "Killa", prefixes: ["killa"] },
  { canonical: "Kronan", prefixes: ["kronan"] },
  { canonical: "Kuma", prefixes: ["kuma"] },
  { canonical: "LD", prefixes: ["ld"] },
  { canonical: "Lewa", prefixes: ["lewa"] },
  { canonical: "Lonkero", prefixes: ["lonkero"] },
  { canonical: "Loop", prefixes: ["loop"] },
  { canonical: "Lundgrens", prefixes: ["lundgrens"] },
  { canonical: "Mustang", prefixes: ["mustang"] },
  { canonical: "Odens", prefixes: ["oden's", "odens"] },
  { canonical: "on!", prefixes: ["on!"] },
  { canonical: "Onico", prefixes: ["onico"] },
  { canonical: "Pablo", prefixes: ["pablo"] },
  { canonical: "Siberia", prefixes: ["siberia"] },
  { canonical: "Skruf", prefixes: ["skruf"] },
  { canonical: "Taboca", prefixes: ["taboca"] },
  { canonical: "Vårgårda", prefixes: ["vårgårda"] },
  { canonical: "VEEV", prefixes: ["veev"] },
  { canonical: "Velo", prefixes: ["velo"] },
  { canonical: "Vont", prefixes: ["vont"] },
  { canonical: "Vozol", prefixes: ["vozol"] },
  { canonical: "WOW!", prefixes: ["wow!"] },
  { canonical: "X", prefixes: ["x"] },
  { canonical: "XO", prefixes: ["xo"] },
  { canonical: "XQS", prefixes: ["xqs"] },
  { canonical: "Zixs", prefixes: ["zixs"] },
  { canonical: "ZONE", prefixes: ["zone"] },
  { canonical: "Zyn", prefixes: ["zyn"] },
  { canonical: "Änglaholm", prefixes: ["änglaholm"] },
];

/**
 * Après numbers its range "No.4 Après Cola" — the leading No.N is a product
 * line, not the brand, so it is stripped before brand matching.
 */
export const LEADING_LINE_NUMBER = /^no\.\s*\d+\s+/i;

/** Longest prefix first, so multi-word brands beat their own first token. */
export const BRAND_LOOKUP: { prefix: string; canonical: string }[] = BRANDS.flatMap((entry) =>
  entry.prefixes.map((prefix) => ({ prefix, canonical: entry.canonical }))
).sort((a, b) => b.prefix.length - a.prefix.length);
