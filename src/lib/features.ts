import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { ALL_FEATURES, type Features } from "@/lib/feature-keys";

export { FEATURE_KEYS, ALL_FEATURES, NO_FEATURES } from "@/lib/feature-keys";
export type { FeatureKey, Features } from "@/lib/feature-keys";

/**
 * Which modules are actually usable right now.
 *
 * Two reasons a module hides: it is not configured (no credentials, no keys),
 * or it has no content yet (no published quiz, no imported shift). Either way
 * the navigation should not offer it — an empty page a user tapped into is
 * worse than a menu that is one item shorter.
 *
 * Hidden here is never a permission. Every route keeps its own server check,
 * and a hidden module is still reachable by URL for whoever may open it.
 *
 * Resolved once per request with React's cache, so the sidebar, the bottom bar
 * and the home page share one set of queries.
 */
function envFlag(name: string): boolean {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Is the schedule backend actually producing shifts?
 *
 * `SCHEDULE_PROVIDER=tooeasy` needs all three credentials — the repo ships
 * them as empty strings, which `envFlag` treats as absent. `manual` needs at
 * least one imported shift, because a manual provider with nothing imported
 * shows every employee an empty week.
 */
async function scheduleIsLive(): Promise<boolean> {
  if (process.env.SCHEDULE_PROVIDER === "tooeasy") {
    return (
      envFlag("TOOEASY_BASE_URL") && envFlag("TOOEASY_USERNAME") && envFlag("TOOEASY_PASSWORD")
    );
  }
  return (await prisma.shift.count()) > 0;
}

export const getFeatures = cache(async (): Promise<Features> => {
  try {
    const [schedule, news, checklists, quizzes, routines, brands, products] = await Promise.all([
      scheduleIsLive(),
      prisma.announcement.count({ where: { publishedAt: { not: null } } }),
      prisma.checklistTemplate.count({ where: { active: true } }),
      prisma.quiz.count({ where: { published: true } }),
      prisma.knowledgeArticle.count({ where: { published: true } }),
      prisma.brand.count({ where: { published: true } }),
      prisma.product.count({ where: { active: true } }),
    ]);

    return {
      ordering: products > 0,
      schedule,
      news: news > 0,
      checklists: checklists > 0,
      quizzes: quizzes > 0,
      routines: routines > 0,
      guide: brands > 0,
      // No web-push keys exist in this app. Kept as a flag so the settings
      // screen has something to ask, rather than a `false` buried in a view.
      push: envFlag("VAPID_PUBLIC_KEY") && envFlag("VAPID_PRIVATE_KEY"),
    };
  } catch {
    // A flag query failing must not blank the navigation. Showing a module
    // that turns out to be empty is the lesser harm.
    return { ...ALL_FEATURES, push: false };
  }
});
