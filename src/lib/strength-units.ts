/**
 * How a supplier states nicotine strength.
 *
 * Suppliers do not agree, and the numbers are not interchangeable: Loop quotes
 * **mg per gram** of pouch material, XQS quotes **mg per påse**. A 25 mg/g
 * Loop pouch and a 25 mg/påse product are not the same thing, and nothing in
 * this app should convert between them — the conversion needs a pouch weight
 * we are not given.
 *
 * Null is a real value here: it means the supplier has not told us, which is
 * different from either unit.
 */
export const STRENGTH_UNITS = ["MG_PER_G", "MG_PER_POUCH"] as const;

export type StrengthUnit = (typeof STRENGTH_UNITS)[number];

/** Short form, for printing beside a figure. */
export const STRENGTH_UNIT_LABELS: Record<StrengthUnit, string> = {
  MG_PER_G: "mg/g",
  MG_PER_POUCH: "mg/påse",
};

/** One sentence, for a note under a strength list. */
export const STRENGTH_UNIT_NOTES: Record<StrengthUnit, string> = {
  MG_PER_G:
    "Leverantören anger styrkan i milligram nikotin per gram (mg/g). Det är inte samma sak som mg per påse och går inte att jämföra rakt av med andra märken.",
  MG_PER_POUCH:
    "Leverantören anger styrkan i milligram nikotin per påse (mg/påse).",
};

export function isStrengthUnit(value: unknown): value is StrengthUnit {
  return typeof value === "string" && (STRENGTH_UNITS as readonly string[]).includes(value);
}

/** Unknown and absent both become null — never a guessed unit. */
export function toStrengthUnit(value: unknown): StrengthUnit | null {
  return isStrengthUnit(value) ? value : null;
}

export function strengthUnitLabel(value: unknown): string | null {
  const unit = toStrengthUnit(value);
  return unit ? STRENGTH_UNIT_LABELS[unit] : null;
}

export function strengthUnitNote(value: unknown): string | null {
  const unit = toStrengthUnit(value);
  return unit ? STRENGTH_UNIT_NOTES[unit] : null;
}
