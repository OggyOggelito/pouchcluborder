/**
 * Flavour grouping rules — the single place that decides which group a flavour
 * belongs to.
 *
 * Rules are keyword based, Swedish and English, because flavour names in the
 * catalog are parsed from supplier product names and mix both languages
 * freely ("Hallon Lakrits", "Blueberry Mint", "Äpple").
 *
 * A flavour can land in more than one group — "Blueberry Mint" is berry *and*
 * mint — which is what the finder's filters expect. A flavour that matches
 * nothing gets no tags at all rather than a guess; those surface in
 * /admin/flavor-tags for a human to sort.
 *
 * Deliberately NOT here: any notion of strength or intensity. Brands use their
 * own words for that (Regular, Strong, Extra Strong) and the finder shows
 * those verbatim.
 */

export const FLAVOR_GROUPS = [
  "mint",
  "fruit",
  "berry",
  "citrus",
  "tropical",
  "cola",
  "liquorice",
  "sweet",
] as const;

export type FlavorGroup = (typeof FLAVOR_GROUPS)[number];

export const FLAVOR_GROUP_LABELS: Record<FlavorGroup, string> = {
  mint: "Mint & mentol",
  fruit: "Frukt",
  berry: "Bär",
  citrus: "Citrus",
  tropical: "Tropiskt",
  cola: "Cola & läsk",
  liquorice: "Lakrits",
  sweet: "Sött, dessert & kaffe",
};

/** Shown in the UI for products that matched no rule. */
export const UNTAGGED_LABEL = "Utan smakgrupp";

/**
 * Compound words that would otherwise be caught by a shorter keyword, mapped
 * explicitly and then removed from the string before the generic rules run.
 *
 * "körsbär" ends in "bär" but is a stone fruit, not a berry; "lingonberry"
 * is the reverse case and stays a berry.
 */
const SPECIFIC_TERMS: { term: string; groups: FlavorGroup[] }[] = [
  { term: "korsbar", groups: ["fruit"] },
  // Contains both "grape" and "fruit", but citrus is the useful group.
  { term: "grapefruit", groups: ["citrus"] },
  { term: "grapefrukt", groups: ["citrus"] },
  // "pineapple" ends in "apple" but is tropical, not an apple.
  { term: "pineapple", groups: ["tropical"] },
  { term: "pina colada", groups: ["tropical"] },
  { term: "cherry", groups: ["fruit"] },
  { term: "bubble gum", groups: ["sweet"] },
  { term: "bubblegum", groups: ["sweet"] },
  { term: "tuggummi", groups: ["sweet"] },
  { term: "root beer", groups: ["cola"] },
  { term: "ginger ale", groups: ["cola"] },
];

/**
 * Keyword lists per group.
 *
 * `part` matches anywhere in the string, which is what Swedish compounds need
 * ("hallonsoda" contains "hallon", "blabarssmak" contains "blabar").
 *
 * `word` matches whole words only, for keywords short enough to appear inside
 * unrelated ones — "ice" is a substring of "juice", "one" of "lemonade", "pop"
 * of "popcorn". Those go here or they mis-tag.
 */
type GroupRules = { part: string[]; word: string[] };

const RULES: Record<FlavorGroup, GroupRules> = {
  mint: {
    part: [
    "mint", "mynta", "menthol", "mentol", "peppermint", "pepparmynta",
    "spearmint", "gronmynta", "wintergreen", "winter green", "eucalyptus",
    "eukalyptus", "kyla", "freeze", "icy", "arctic", "fresh mint",
    ],
    word: ["ice", "cool", "cold", "frost", "polar", "chill"],
  },
  fruit: {
    part: [
    "apple", "applen", "frukt", "fruit", "paron", "persika", "peach", "aprikos", "apricot", "plommon",
    "melon", "vattenmelon", "watermelon", "honey melon", "honungsmelon",
    "grape", "druva", "vindruva", "banan", "banana", "kiwi", "fikon",
    ],
    // Short enough to hide inside other words: "pear" is in "spearmint",
    // "fig" in "figs"/"configure", "plum" in "plumbago".
    word: ["punch", "rhub", "rabarber", "rhubarb", "pear", "fig", "plum"],
  },
  berry: {
    part: [
    "berry", "berries", "blabar", "blueberry", "hallon", "raspberry",
    "razz", "jordgubb", "strawberry", "smultron", "lingon", "vinbar",
    "currant", "blackcurrant", "blackberry", "bjornbar", "tranbar",
    "cranberry", "hjortron", "cloudberry", "fläder", "elderberry",
    "elderflower", "flader",
    ],
    word: ["acai", "bar"],
  },
  citrus: {
    part: [
    "citrus", "citron", "lemon", "lime", "apelsin", "orange", "grapefruit",
    "grapefrukt", "mandarin", "klementin", "clementine", "bergamott",
    "bergamot", "yuzu",
    ],
    word: ["limoncello", "oranssi"],
  },
  tropical: {
    part: [
    "tropical", "tropisk", "mango", "ananas", "pineapple", "passion",
    "passionsfrukt", "kokos", "coconut", "papaya", "guava", "lychee",
    "litchi", "maracuja", "dragon fruit", "drakfrukt", "banana ice",
    ],
    word: [],
  },
  cola: {
    part: [
    "cola", "soda", "lask", "lemonade", "lemonad", "fizzy", "bubbly",
    "spritz", "champagne", "tonic", "energy", "energidryck", "slush",
    ],
    word: ["pop", "negroni", "mojito"],
  },
  liquorice: {
    part: [
    "lakrits", "liquorice", "licorice", "salmiak", "salty liquorice",
    "salmiakki", "anis", "anise",
    ],
    word: ["liqorice"],
  },
  sweet: {
    part: [
    "kaffe", "coffee", "cappuccino", "espresso", "latte", "americano",
    "mocha", "mochaccino", "vanilj", "vanilla", "choklad", "chocolate",
    "kola", "caramel", "karamell", "toffee", "fudge", "honung", "honey",
    "candy", "godis", "dessert", "grädde", "gradde", "cream", "creamy",
    "marsipan", "marzipan", "kanel", "cinnamon", "pepparkaka", "nougat",
    "sweet", "sot",
    ],
    word: ["gummy", "bubble", "ginger", "ingefara", "violet"],
  },
};

/** Lowercase and strip diacritics so "Blåbär" and "blabar" compare equal. */
export function foldFlavor(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Groups for one flavour name. Returns an empty array when nothing matches —
 * never a fallback group, because "other" as a guess is indistinguishable from
 * "nobody has looked at this yet".
 */
export function tagsForFlavor(flavor: string): FlavorGroup[] {
  const folded = foldFlavor(flavor);
  if (!folded) return [];

  const groups = new Set<FlavorGroup>();
  let working = folded;

  // Specific compounds first, removed so the generic rules cannot re-match
  // their fragments ("körsbär" must not also read as "bär").
  for (const { term, groups: termGroups } of SPECIFIC_TERMS) {
    if (working.includes(term)) {
      termGroups.forEach((group) => groups.add(group));
      working = working.split(term).join(" ");
    }
  }

  for (const group of FLAVOR_GROUPS) {
    const rules = RULES[group];
    const hit =
      rules.part.some((keyword) => working.includes(keyword)) ||
      rules.word.some((keyword) => hasWord(working, keyword));
    if (hit) groups.add(group);
  }

  return [...groups];
}

/** Whole-word match, so "ice" does not fire inside "juice". */
function hasWord(haystack: string, word: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${word}([^a-z0-9]|$)`).test(haystack);
}

/** Stored as a comma-separated string on Product.flavorTags. */
export function serializeTags(groups: FlavorGroup[]): string | null {
  return groups.length > 0 ? groups.join(",") : null;
}

export function parseTags(value: string | null | undefined): FlavorGroup[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part): part is FlavorGroup => (FLAVOR_GROUPS as readonly string[]).includes(part));
}
