/**
 * The brand tokens, for the places TypeScript needs a literal value — a
 * `<meta name="theme-color">` tag cannot hold a CSS variable.
 *
 * src/styles/tokens.css is the source of truth. This file must agree with it,
 * and `tests/theme-contrast.test.ts` parses the CSS and fails if the two ever
 * drift, so there is no second place to maintain by hand.
 */
export const TOKENS = {
  bg: "#02152d",
  surface: "#0a2442",
  "surface-raised": "#12335c",
  text: "#f8c50b",
  "text-muted": "#a9b8cc",
  primary: "#f8c50b",
  "on-primary": "#02152d",
  "primary-hover": "#ffd23a",
  "primary-pressed": "#dcaa00",
  border: "#2c4a75",
  "border-control": "#5b7fae",
  focus: "#f8c50b",
  danger: "#ff7b7b",
  success: "#5ee08a",
  info: "#7cc7ff",
  warning: "#ff9a3c",
} as const;

export type TokenName = keyof typeof TOKENS;

/** The three surfaces text and borders are judged against. */
export const SURFACES = ["bg", "surface", "surface-raised"] as const;

/** Browser chrome: Android's toolbar, iOS's status bar area. */
export const THEME_COLOR = TOKENS.bg;
