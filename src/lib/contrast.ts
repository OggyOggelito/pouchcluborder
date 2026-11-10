/**
 * WCAG relative luminance and contrast ratio.
 *
 * Here so the theme's own test can check every token pair, rather than the
 * numbers living only in a comment that nobody recomputes when a value
 * changes.
 */
export function parseHex(hex: string): { r: number; g: number; b: number } {
  const value = hex.trim().replace(/^#/, "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((char) => char + char)
          .join("")
      : value;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Not a hex colour: ${hex}`);
  }

  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

/** WCAG 2.1 relative luminance. */
export function luminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  const channel = (value: number) => {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** 1 to 21. Order of the arguments does not matter. */
export function contrastRatio(a: string, b: string): number {
  const first = luminance(a);
  const second = luminance(b);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Rounded the way a report quotes it. */
export function ratio(a: string, b: string): number {
  return Math.round(contrastRatio(a, b) * 10) / 10;
}
