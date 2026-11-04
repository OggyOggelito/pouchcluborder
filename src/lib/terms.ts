/**
 * The words the app uses for the things it counts.
 *
 * Before this file the same idea was written as "stock", "stockar", "dosa",
 * "dosor" and "antal" depending on the screen, and nothing anywhere said what
 * a stock actually was. One definition, used by every label, and a `?` the
 * first time it appears on a screen.
 *
 * Swedish nouns need both forms, and the declension is irregular enough that
 * callers must not try to build the plural by appending an "r".
 */
export type Term = {
  /** Lowercase singular, as it appears mid-sentence. */
  one: string;
  /** Lowercase plural. */
  many: string;
  /** One sentence, shown behind the `?`. Plain language, no jargon. */
  explanation: string;
};

export const TERMS = {
  stock: {
    one: "stock",
    many: "stockar",
    explanation:
      "En stock är en förpackning med flera dosor — det är så vi beställer från leverantören.",
  },
  can: {
    one: "dosa",
    many: "dosor",
    explanation: "En dosa är den enskilda burken kunden köper.",
  },
} as const satisfies Record<string, Term>;

export type TermKey = keyof typeof TERMS;

/** "1 stock", "3 stockar" — the count and the right form, always together. */
export function countOf(key: TermKey, count: number): string {
  const term = TERMS[key];
  return `${count} ${count === 1 ? term.one : term.many}`;
}

/** The bare noun in the right form, when the number is rendered separately. */
export function termFor(key: TermKey, count: number): string {
  const term = TERMS[key];
  return count === 1 ? term.one : term.many;
}

export function explanationOf(key: TermKey): string {
  return TERMS[key].explanation;
}
