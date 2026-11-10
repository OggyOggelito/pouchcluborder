import type { FeatureKey, Features } from "@/lib/feature-keys";
import { ROLES, type Role } from "@/lib/roles";

/**
 * The one place routes are registered.
 *
 * Everything that renders navigation reads this file: the mobile bottom bar,
 * the "Mer" sheet, the desktop sidebar, the admin hub and global search. A
 * feature added later registers here and appears everywhere, in the right
 * group, for the right roles.
 *
 * Two rules this file does not break:
 *
 * 1. Visibility is not permission. Hiding a link never protects a route —
 *    every page keeps its own server-side check, and a hidden entry stays
 *    reachable by URL for whoever is allowed to open it.
 * 2. A module with nothing in it hides rather than greys out. `feature` points
 *    at a flag in src/lib/features.ts; an unconfigured or empty module simply
 *    is not offered.
 */

/** Sidebar and sheet sections, in the order they are rendered. */
export const NAV_GROUPS = ["today", "shop", "me", "admin"] as const;
export type NavGroup = (typeof NAV_GROUPS)[number];

export const NAV_GROUP_LABELS: Record<NavGroup, string> = {
  today: "Start",
  shop: "I butiken",
  me: "Mitt",
  admin: "Admin",
};

/** Keys into the icon set in src/components/nav/NavIcon.tsx. */
export type NavIconName =
  | "today"
  | "order"
  | "guide"
  | "news"
  | "search"
  | "notes"
  | "issue"
  | "request"
  | "transfer"
  | "routine"
  | "checklist"
  | "quiz"
  | "schedule"
  | "team"
  | "history"
  | "onboarding"
  | "bell"
  | "settings"
  | "admin"
  | "logout";

export type NavEntry = {
  href: string;
  label: string;
  /** One line, used by the home page, the sheet and search results. */
  description?: string;
  /** Roles that may see it. A signed-out visitor sees `publicAccess` entries. */
  roles: readonly Role[];
  /** Hidden while this feature flag is false. */
  feature?: FeatureKey;
  group: NavGroup;
  icon: NavIconName;
  publicAccess?: boolean;
  /** Offer it in global search's "Sidor" group. */
  searchable?: boolean;
  /**
   * Slot in the mobile bottom bar, lowest first. At most four are rendered;
   * everything else lives behind "Mer".
   */
  bottomBar?: number;
};

const ALL_ROLES = ROLES;
const MANAGERS = ["OWNER", "ADMIN"] as const;
const ADMIN_ONLY = ["ADMIN"] as const;

export const NAV_ENTRIES: NavEntry[] = [
  {
    href: "/",
    label: "Idag",
    description: "Dagens pass, checklistor och nyheter.",
    roles: ALL_ROLES,
    group: "today",
    icon: "today",
    bottomBar: 1,
    searchable: true,
  },
  {
    href: "/order",
    label: "Beställ",
    description: "Lägg en påfyllningsbeställning.",
    roles: MANAGERS,
    feature: "ordering",
    group: "shop",
    icon: "order",
    bottomBar: 2,
    searchable: true,
  },
  {
    href: "/staff",
    label: "Guide",
    description: "Om varumärkena vi säljer.",
    roles: ALL_ROLES,
    feature: "guide",
    group: "shop",
    icon: "guide",
    publicAccess: true,
    bottomBar: 3,
    searchable: true,
  },
  {
    href: "/news",
    label: "Nyheter",
    description: "Nya produkter och butiksnyheter.",
    roles: ALL_ROLES,
    feature: "news",
    group: "shop",
    icon: "news",
    bottomBar: 4,
    searchable: true,
  },
  {
    href: "/staff/finder",
    label: "Produktsök",
    description: "Hitta rätt produkt åt kunden.",
    roles: ALL_ROLES,
    group: "shop",
    icon: "search",
    publicAccess: true,
    searchable: true,
  },
  {
    href: "/store/notes",
    label: "Skiftanteckningar",
    description: "Vad nästa skift behöver veta.",
    roles: ALL_ROLES,
    group: "shop",
    icon: "notes",
    searchable: true,
  },
  {
    href: "/store/issues",
    label: "Problemrapporter",
    description: "Skadad vara, fel etikett, trasig utrustning.",
    roles: ALL_ROLES,
    group: "shop",
    icon: "issue",
    searchable: true,
  },
  {
    href: "/requests/new",
    label: "Kundönskemål",
    description: "Logga vad kunder frågar efter.",
    roles: ALL_ROLES,
    group: "shop",
    icon: "request",
    searchable: true,
  },
  {
    href: "/transfers",
    label: "Överföringar",
    description: "Låna produkter mellan butiker.",
    roles: ALL_ROLES,
    group: "shop",
    icon: "transfer",
    searchable: true,
  },
  {
    href: "/staff/routines",
    label: "Rutiner",
    description: "Hur vi gör saker i butik.",
    roles: ALL_ROLES,
    feature: "routines",
    group: "shop",
    icon: "routine",
    searchable: true,
  },
  {
    href: "/orders",
    label: "Tidigare beställningar",
    description: "Beställningar butiken har skickat.",
    roles: MANAGERS,
    feature: "ordering",
    group: "shop",
    icon: "history",
    searchable: true,
  },
  {
    href: "/staff/checklists",
    label: "Checklistor",
    description: "Öppning och stängning.",
    roles: ALL_ROLES,
    feature: "checklists",
    group: "me",
    icon: "checklist",
    searchable: true,
  },
  {
    href: "/staff/quizzes",
    label: "Quiz",
    description: "Testa dig själv.",
    roles: ALL_ROLES,
    feature: "quizzes",
    group: "me",
    icon: "quiz",
    searchable: true,
  },
  {
    href: "/schedule",
    label: "Mitt schema",
    description: "Dina pass och butikens vecka.",
    roles: ALL_ROLES,
    feature: "schedule",
    group: "me",
    icon: "schedule",
    searchable: true,
  },
  // Entering the schedule, finding cover and the extra-shift queue are three
  // steps of one job, so they sit together under "I butiken" rather than with
  // the personal pages. All three are registered so search can find them.
  {
    href: "/store/schedule",
    label: "Teamschema",
    description: "Skriv in butikens vecka.",
    roles: MANAGERS,
    feature: "schedule",
    group: "shop",
    icon: "team",
    searchable: true,
  },
  {
    href: "/schedule/available",
    label: "Lediga hos andra",
    description: "Vem kan ta ett extrapass hos er.",
    roles: MANAGERS,
    feature: "schedule",
    group: "shop",
    icon: "schedule",
    searchable: true,
  },
  {
    href: "/schedule/extra",
    label: "Extrapass",
    description: "Förfrågningar in och ut.",
    roles: MANAGERS,
    feature: "schedule",
    group: "shop",
    icon: "request",
    searchable: true,
  },
  {
    href: "/store/employees",
    label: "Anställda",
    description: "Butikens personal och vem som får erbjudas extrapass.",
    roles: MANAGERS,
    feature: "schedule",
    group: "shop",
    icon: "team",
    searchable: true,
  },
  {
    href: "/my-onboarding",
    label: "Introduktion",
    description: "Din egen introduktion.",
    roles: ALL_ROLES,
    feature: "checklists",
    group: "me",
    icon: "onboarding",
    searchable: true,
  },
  {
    href: "/notifications",
    label: "Aviseringar",
    description: "Vad som hänt i dina ärenden.",
    roles: ALL_ROLES,
    group: "me",
    icon: "bell",
    searchable: true,
  },
  {
    href: "/settings",
    label: "Inställningar",
    description: "Ditt konto och dina butiker.",
    roles: ALL_ROLES,
    group: "me",
    icon: "settings",
    searchable: true,
  },
  {
    href: "/admin",
    label: "Admin",
    description: "Beställningar, sortiment, innehåll och personal.",
    roles: ADMIN_ONLY,
    group: "admin",
    icon: "admin",
    searchable: true,
  },
];

// ---------------------------------------------------------------------------
// Admin hub
// ---------------------------------------------------------------------------

/** The jobs an admin page belongs to, in hub order. */
export const ADMIN_SECTIONS = ["orders", "catalog", "content", "people", "integrations"] as const;
export type AdminSection = (typeof ADMIN_SECTIONS)[number];

export const ADMIN_SECTION_LABELS: Record<AdminSection, string> = {
  orders: "Beställningar och efterfrågan",
  catalog: "Sortiment",
  content: "Innehåll",
  people: "Personal och behörigheter",
  integrations: "Integrationer",
};

export type AdminEntry = {
  href: string;
  label: string;
  description: string;
  section: AdminSection;
  /**
   * Hidden while this feature flag is false — same rule as a NavEntry.
   * The TooEasy pages use it: a mapping screen for an integration that is
   * switched off is a dead end, and the code behind it is still there.
   */
  feature?: FeatureKey;
  /**
   * Which "behöver åtgärd" count belongs on this card, if any. Resolved in
   * src/lib/repositories/admin-counts.ts — a key rather than a number so this
   * file stays a plain config with no queries in it.
   */
  actionCount?: "openIssues" | "newRequests" | "openTransfers" | "needsReview" | "draftContent";
  searchable?: boolean;
};

export const ADMIN_ENTRIES: AdminEntry[] = [
  {
    href: "/admin/requests",
    label: "Kundönskemål",
    description: "Rankad efterfrågan per butik.",
    section: "orders",
    actionCount: "newRequests",
    searchable: true,
  },
  {
    href: "/admin/transfers",
    label: "Överföringar",
    description: "Alla överföringar mellan butiker.",
    section: "orders",
    actionCount: "openTransfers",
    searchable: true,
  },
  {
    href: "/admin/issues",
    label: "Problemrapporter",
    description: "Kö, filter och tilldelning.",
    section: "orders",
    actionCount: "openIssues",
    searchable: true,
  },
  {
    href: "/admin/review",
    label: "Granskningskö",
    description: "Produkter importen inte kunde tolka säkert.",
    section: "catalog",
    actionCount: "needsReview",
    searchable: true,
  },
  {
    href: "/admin/flavor-tags",
    label: "Utan smakgrupp",
    description: "Sortera produkter som ingen regel träffade.",
    section: "catalog",
    searchable: true,
  },
  {
    href: "/admin/brands",
    label: "Varumärken",
    description: "Innehåll på varumärkessidorna.",
    section: "content",
    actionCount: "draftContent",
    searchable: true,
  },
  {
    href: "/admin/routines",
    label: "Rutiner",
    description: "Skriv rutiner och hantera kategorier.",
    section: "content",
    searchable: true,
  },
  {
    href: "/admin/announcements",
    label: "Nyheter",
    description: "Skriv och publicera.",
    section: "content",
    searchable: true,
  },
  {
    href: "/admin/checklists",
    label: "Checklistor",
    description: "Mallar och dagens status.",
    section: "content",
    searchable: true,
  },
  {
    href: "/admin/quizzes",
    label: "Quiz",
    description: "Frågor och resultat.",
    section: "content",
    searchable: true,
  },
  {
    href: "/admin/users",
    label: "Konton",
    description: "Skapa konton och koppla butiker.",
    section: "people",
    searchable: true,
  },
  {
    href: "/admin/schedule",
    label: "Schema",
    description: "Öppettider, medarbetare och aktiv källa.",
    section: "people",
    searchable: true,
  },
  {
    href: "/admin/nearby",
    label: "Närliggande butiker",
    description: "Vilka butiker som ser varandras lediga medarbetare.",
    section: "people",
    searchable: true,
  },
  {
    href: "/admin/tooeasy",
    label: "TooEasy",
    description: "Schemakoppling och status.",
    section: "integrations",
    feature: "tooeasy",
    searchable: true,
  },
];

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

/** Whether a role may see an entry at all, ignoring feature flags. */
export function roleMaySee(entry: NavEntry, role: Role | null): boolean {
  if (role === null) return entry.publicAccess === true;
  return entry.roles.includes(role);
}

function featureOn(entry: NavEntry, features: Features | null): boolean {
  if (!entry.feature) return true;
  if (!features) return true;
  return features[entry.feature];
}

/** Everything this user should be offered, in config order. */
export function navFor(role: Role | null, features: Features | null = null): NavEntry[] {
  return NAV_ENTRIES.filter((entry) => roleMaySee(entry, role) && featureOn(entry, features));
}

/** The mobile bottom bar: at most four, by slot. */
export function bottomBarFor(role: Role | null, features: Features | null = null): NavEntry[] {
  return navFor(role, features)
    .filter((entry) => entry.bottomBar !== undefined)
    .sort((a, b) => (a.bottomBar ?? 0) - (b.bottomBar ?? 0))
    .slice(0, 4);
}

/** Grouped, for the sidebar and the "Mer" sheet. Empty groups are dropped. */
export function groupedNavFor(
  role: Role | null,
  features: Features | null = null
): { group: NavGroup; label: string; entries: NavEntry[] }[] {
  const visible = navFor(role, features);
  return NAV_GROUPS.map((group) => ({
    group,
    label: NAV_GROUP_LABELS[group],
    entries: visible.filter((entry) => entry.group === group),
  })).filter((section) => section.entries.length > 0);
}

function adminFeatureOn(entry: AdminEntry, features: Features | null): boolean {
  if (!entry.feature) return true;
  if (!features) return true;
  return features[entry.feature];
}

/**
 * Admin hub cards, grouped by job.
 *
 * Passing no flags lists every card, which is what the config test wants:
 * hiding is a rendering decision, and the registry itself stays complete.
 */
export function adminSections(
  features: Features | null = null
): { section: AdminSection; label: string; entries: AdminEntry[] }[] {
  return ADMIN_SECTIONS.map((section) => ({
    section,
    label: ADMIN_SECTION_LABELS[section],
    entries: ADMIN_ENTRIES.filter(
      (entry) => entry.section === section && adminFeatureOn(entry, features)
    ),
  })).filter((group) => group.entries.length > 0);
}

/** Pages global search may offer. */
export function searchablePagesFor(
  role: Role | null,
  features: Features | null = null
): { href: string; label: string; description?: string }[] {
  const pages = navFor(role, features)
    .filter((entry) => entry.searchable)
    .map((entry) => ({ href: entry.href, label: entry.label, description: entry.description }));

  if (role === "ADMIN") {
    pages.push(
      ...ADMIN_ENTRIES.filter(
        (entry) => entry.searchable && adminFeatureOn(entry, features)
      ).map((entry) => ({
        href: entry.href,
        label: `Admin · ${entry.label}`,
        description: entry.description,
      }))
    );
  }
  return pages;
}

/**
 * Which nav entry a pathname belongs to, for the active state.
 *
 * Longest matching href wins, so /store/issues/new highlights
 * "Problemrapporter" rather than falling through. "/" only ever matches
 * exactly, or it would own every path in the app.
 */
export function activeHref(pathname: string, entries: NavEntry[]): string | null {
  let best: string | null = null;
  for (const entry of entries) {
    const matches =
      entry.href === "/"
        ? pathname === "/"
        : pathname === entry.href || pathname.startsWith(`${entry.href}/`);
    if (matches && (best === null || entry.href.length > best.length)) {
      best = entry.href;
    }
  }
  return best;
}
