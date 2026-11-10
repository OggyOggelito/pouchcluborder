/**
 * Feature flag names and shapes.
 *
 * Deliberately separate from src/lib/features.ts, which carries the
 * `server-only` marker and the database queries. `server-only` is a Next
 * bundler alias rather than an installed package, so anything importing it
 * cannot be loaded by a plain `tsx` process — which is how the test runner
 * and the CLI scripts work. The navigation config and the tests need the
 * types, not the queries, so the types live here.
 */
export const FEATURE_KEYS = [
  "ordering",
  "schedule",
  "news",
  "checklists",
  "quizzes",
  "routines",
  "guide",
  "push",
  "tooeasy",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type Features = Record<FeatureKey, boolean>;

/** Everything on — the shape callers get when flags cannot be resolved. */
export const ALL_FEATURES: Features = Object.fromEntries(
  FEATURE_KEYS.map((key) => [key, true])
) as Features;

/** Nothing on. Used by tests and by a "what if this is not set up" render. */
export const NO_FEATURES: Features = Object.fromEntries(
  FEATURE_KEYS.map((key) => [key, false])
) as Features;
