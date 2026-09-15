import { BRAND_LOOKUP, LEADING_LINE_NUMBER } from "@/lib/brands";
import { normalizeStrength } from "@/lib/catalog";

export type ParsedProduct = {
  brand: string;
  flavor: string;
  strength: string;
  format: string;
  needsReview: boolean;
  reviewNotes: string[];
};

/**
 * Formats seen in the masterdoc. The four pouch formats from Phase 1 plus the
 * two that only apply to tobacco snus (loose vs portion), because for those
 * products "Lös" genuinely is the format rather than part of the flavor.
 */
const FORMAT_PATTERNS: { format: string; pattern: RegExp }[] = [
  { format: "Mini", pattern: /\bmini\b/i },
  { format: "Slim", pattern: /\b(super\s*slim|superslim|slims|slim)\b/i },
  { format: "Large", pattern: /\b(large|maxi|long)\b/i },
  { format: "Lös", pattern: /\b(lös|los)\b/i },
  { format: "Portion", pattern: /\bportion\b/i },
  { format: "Normal", pattern: /\b(normal|regular)\b/i },
];

/**
 * Strength notations in the file, most specific first:
 *   "10,4 mg" / "20mg" / "10mg/p"   -> milligrams
 *   "#3" / "#4"                      -> Swedish strength tier
 *   "S2" / "S4"                      -> ZYN's strength code
 * Word strengths ("Extra Strong", "Hypèr Strong", "Stark") are the fallback,
 * since plenty of tobacco products have no number at all.
 */
const MG_PATTERN = /(\d+(?:[.,]\d+)?)\s*mg(?:\/p)?\b/i;
const TIER_PATTERN = /#\s*(\d+)/;
const ZYN_CODE_PATTERN = /\bS(\d)\b/;

const WORD_STRENGTHS: { label: string; pattern: RegExp }[] = [
  { label: "Hyper Strong", pattern: /\bhyp[eè]r\s+strong\b/i },
  { label: "Ultra Strong", pattern: /\bultra\s+(strong|stark)\b/i },
  { label: "Super Strong", pattern: /\bsuper\s+(strong|stark)\b/i },
  // "Xtra Stark" is Knox's spelling of extra strong; without it, "Knox Stark
  // White" and "Knox Xtra Stark White" both collapse to plain Strong.
  { label: "Extra Strong", pattern: /\b(extra\s+strong|x-?tra\s+(strong|stark)|x-?strong|extra\s+stark)\b/i },
  { label: "Strong", pattern: /\b(strong|stark)\b/i },
  { label: "Hyper", pattern: /\bhyp[eè]r\b/i },
  { label: "Max", pattern: /\bmax\b/i },
  { label: "Medium", pattern: /\bmedium\b/i },
  { label: "Regular", pattern: /\bregular\b/i },
];

/**
 * Descriptors that are neither brand, flavor, strength nor format.
 *
 * Note what is deliberately NOT here: "White" / "Vit" / "All White". For tobacco
 * snus those name a real variant ("Ettan Portion" and "Ettan Portion Vit" are
 * different articles), so they stay in the flavor and keep the two apart.
 */
const NOISE_PATTERNS: RegExp[] = [
  /\([^)]*\)/g, // "(ersätter art.nr 10750)", "(10-pack)", "(SLEEVED)"
  /\/\s*\d+(?:[.,]\d+)?\s*g\.?/gi, // "/19,2 g." weight suffixes
  /\bengångs\s*vape\b/gi,
  /\bengångsvape?\b/gi,
  /\b\d+\s*-\s*p(?:ack)?\b/gi, // "2-p", "3-Pack", "1-Pod Pack" handled below
  /\b\d+\s*-\s*pod\s*pack\b/gi,
  /\bno\.\s*\d+\b/gi, // Skruf "Fresh no. 10"
];

/**
 * Whether a missing strength is a data problem or just how the category is sold.
 * Nicotine-free pouches have no nicotine to state, and a tobacco snus without a
 * strength word is the standard strength — neither needs a human to look at it.
 * A nicotine pouch or a vape with no strength in the name genuinely does.
 */
const STRENGTH_DEFAULTS: Record<string, { value: string; flag: boolean }> = {
  "Nicotine-free pouch": { value: "0mg", flag: false },
  "Tobacco snus": { value: "Regular", flag: false },
  "Nicotine pouch": { value: "", flag: true },
  Vape: { value: "", flag: true },
};

export function parseProductName(rawName: string, category = "Nicotine pouch"): ParsedProduct {
  const reviewNotes: string[] = [];
  const original = (rawName ?? "").trim();

  if (!original) {
    return {
      brand: "Okänt",
      flavor: "Okänd",
      strength: "",
      format: "Normal",
      needsReview: true,
      reviewNotes: ["Empty product name."],
    };
  }

  // Après's "No.4 Après Cola" — drop the line number before brand matching.
  const withoutLineNumber = original.replace(LEADING_LINE_NUMBER, "");

  const { brand, rest, matched } = extractBrand(withoutLineNumber);
  if (!matched) {
    reviewNotes.push(`Brand "${brand}" is not in the brand dictionary — guessed from the name.`);
  }

  const extracted = extractStrength(rest);
  let strength = extracted.strength;

  if (!strength) {
    const fallback = STRENGTH_DEFAULTS[category] ?? { value: "", flag: true };
    strength = fallback.value;
    if (fallback.flag) {
      reviewNotes.push("No strength in the name — needs to be filled in by hand.");
    }
  }

  const { format, rest: afterFormat } = extractFormat(extracted.rest);

  const flavor = cleanFlavor(afterFormat);
  if (!flavor) {
    reviewNotes.push("No flavor left after parsing — check the source name.");
  }

  return {
    brand,
    flavor: flavor || "Original",
    strength,
    format,
    needsReview: reviewNotes.length > 0,
    reviewNotes,
  };
}

function extractBrand(name: string): { brand: string; rest: string; matched: boolean } {
  const lower = name.toLowerCase();

  for (const { prefix, canonical } of BRAND_LOOKUP) {
    if (!lower.startsWith(prefix)) continue;

    // Only accept a match that ends on a token boundary, so "Ice" doesn't match
    // inside "Iceberg" and "X" doesn't swallow "XQS".
    const next = name[prefix.length];
    if (next !== undefined && !/[\s\-,]/.test(next)) continue;

    return {
      brand: canonical,
      rest: name.slice(prefix.length).replace(/^[\s\-,]+/, ""),
      matched: true,
    };
  }

  // Unknown brand: assume the first token, flag it, and let a human confirm.
  const [first = name, ...others] = name.split(/\s+/);
  return { brand: first, rest: others.join(" "), matched: false };
}

function extractStrength(name: string): { strength: string; rest: string } {
  // ZYN prints both ("... Slim 11mg S4"); mg wins, but the code must still go,
  // or it ends up in the flavor.
  const withoutZynCode = name.replace(ZYN_CODE_PATTERN, " ");

  const mg = name.match(MG_PATTERN);
  if (mg) {
    return {
      strength: normalizeStrength(mg[1]),
      rest: withoutZynCode.replace(MG_PATTERN, " "),
    };
  }

  const tier = name.match(TIER_PATTERN);
  if (tier) {
    return { strength: `#${tier[1]}`, rest: name.replace(TIER_PATTERN, " ") };
  }

  const zyn = name.match(ZYN_CODE_PATTERN);
  if (zyn) {
    return { strength: `S${zyn[1]}`, rest: name.replace(ZYN_CODE_PATTERN, " ") };
  }

  for (const { label, pattern } of WORD_STRENGTHS) {
    if (pattern.test(name)) {
      return { strength: label, rest: name.replace(pattern, " ") };
    }
  }

  return { strength: "", rest: name };
}

function extractFormat(name: string): { format: string; rest: string } {
  for (const { format, pattern } of FORMAT_PATTERNS) {
    if (pattern.test(name)) {
      return { format, rest: name.replace(pattern, " ") };
    }
  }
  return { format: "Normal", rest: name };
}

function cleanFlavor(name: string): string {
  let flavor = name;
  for (const pattern of NOISE_PATTERNS) {
    flavor = flavor.replace(pattern, " ");
  }

  const cleaned = flavor
    .replace(/[-–—,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Parts of the file are typed in all caps; normalise so the app's brand ->
  // flavor list doesn't shout at the reader.
  if (cleaned.length > 2 && cleaned === cleaned.toUpperCase()) {
    return cleaned
      .toLowerCase()
      .replace(/(^|\s|&\s)([a-zà-ÿ])/g, (match, prefix, letter) => prefix + letter.toUpperCase());
  }

  return cleaned;
}
