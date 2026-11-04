/**
 * Matching a supplier's flavour name to ours.
 *
 * Supplier material and our masterdoc do not agree on spelling. The deck
 * writes "Jalapeño Lime"; our catalog has "Jalapeno Lime", because the
 * masterdoc dropped the tilde. They are the same product, and matching on the
 * raw string silently misses all five of its variants.
 *
 * Deliberately conservative: case, diacritics and whitespace are folded, and
 * nothing else. No stemming, no fuzzy distance, no dropping of words — a
 * near-match between two real flavours ("Hot Mango" and "Mango Chili") must
 * stay a miss, because attaching the wrong supplier text to a product is
 * worse than attaching none.
 */
export function foldFlavor(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function flavorsMatch(a: string, b: string): boolean {
  return foldFlavor(a) === foldFlavor(b);
}
