import type { Role } from "@/lib/roles";
import { canAccessAdmin, canPlaceOrders, canViewTeamSchedule } from "@/lib/roles";

/**
 * The one place routes are registered.
 *
 * There was no central navigation config before this — the header kept a
 * hardcoded array — so this file is new and SiteNav now reads it. Adding a
 * route means adding an entry here, not editing a component.
 *
 * `visible` decides who sees the link. It is presentation only: hiding a link
 * is never the permission, and every page still checks on the server.
 */
export type NavEntry = {
  href: string;
  label: string;
  /** Short description, used by the staff landing list. */
  description?: string;
  /** Where it appears. */
  group: "staff" | "manager" | "admin";
  /** Whether a signed-out visitor can reach it. */
  publicAccess?: boolean;
  /** Offer it in global search / landing lists. */
  searchable?: boolean;
  /**
   * Show it in the desktop header bar rather than only behind the menu.
   *
   * There are thirteen destinations for a signed-in user now, which no header
   * fits inline — so the bar carries the handful reached mid-shift and the
   * menu carries everything.
   */
  primary?: boolean;
  visible: (role: Role | null) => boolean;
};

const signedIn = (role: Role | null): role is Role => role !== null;

export const NAV_ENTRIES: NavEntry[] = [
  {
    href: "/staff",
    primary: true,
    label: "Guide",
    description: "Om varumärkena vi säljer.",
    group: "staff",
    publicAccess: true,
    searchable: true,
    visible: () => true,
  },
  {
    href: "/staff/finder",
    primary: true,
    label: "Produktsök",
    description: "Hitta rätt produkt åt kunden.",
    group: "staff",
    publicAccess: true,
    searchable: true,
    visible: () => true,
  },
  {
    href: "/news",
    primary: true,
    label: "Nyheter",
    description: "Nya produkter och butiksnyheter.",
    group: "staff",
    searchable: true,
    visible: signedIn,
  },
  {
    href: "/requests/new",
    label: "Kundönskemål",
    description: "Logga vad kunder frågar efter.",
    group: "staff",
    searchable: true,
    visible: signedIn,
  },
  {
    href: "/transfers",
    label: "Överföringar",
    description: "Låna produkter mellan butiker.",
    group: "staff",
    searchable: true,
    visible: signedIn,
  },
  {
    href: "/store/notes",
    primary: true,
    label: "Anteckningar",
    description: "Vad nästa skift behöver veta.",
    group: "staff",
    searchable: true,
    visible: signedIn,
  },
  {
    href: "/store/issues",
    label: "Problem",
    description: "Skadad vara, fel etikett, trasig utrustning.",
    group: "staff",
    searchable: true,
    visible: signedIn,
  },
  {
    href: "/staff/routines",
    primary: true,
    label: "Rutiner",
    description: "Hur vi gör saker i butik.",
    group: "staff",
    searchable: true,
    visible: signedIn,
  },
  {
    href: "/staff/checklists",
    label: "Checklistor",
    description: "Öppning och stängning.",
    group: "staff",
    searchable: true,
    visible: signedIn,
  },
  {
    href: "/staff/quizzes",
    label: "Quiz",
    description: "Testa dig själv.",
    group: "staff",
    searchable: true,
    visible: signedIn,
  },
  {
    href: "/my-onboarding",
    label: "Introduktion",
    description: "Din egen introduktion.",
    group: "staff",
    searchable: true,
    visible: signedIn,
  },
  {
    href: "/notifications",
    label: "Aviseringar",
    description: "Vad som hänt med dina överföringar.",
    group: "staff",
    searchable: true,
    visible: signedIn,
  },
  {
    href: "/my-schedule",
    primary: true,
    label: "Schema",
    description: "Dina pass de närmaste 14 dagarna.",
    group: "staff",
    searchable: true,
    visible: signedIn,
  },
  {
    href: "/team-schedule",
    label: "Team",
    description: "Vem jobbar och vem är ledig i regionen.",
    group: "manager",
    searchable: true,
    visible: (role) => signedIn(role) && canViewTeamSchedule(role),
  },
  {
    href: "/orders",
    label: "Tidigare",
    description: "Tidigare beställningar.",
    group: "manager",
    searchable: true,
    visible: (role) => signedIn(role) && canPlaceOrders(role),
  },
  {
    href: "/admin",
    primary: true,
    label: "Admin",
    group: "admin",
    visible: (role) => signedIn(role) && canAccessAdmin(role),
  },
];

/** Admin sub-pages, listed on /admin and in search for admins only. */
export const ADMIN_ENTRIES: NavEntry[] = [
  { href: "/admin/requests", label: "Kundönskemål", description: "Rankad efterfrågan per butik.", group: "admin", searchable: true, visible: (role) => signedIn(role) && canAccessAdmin(role) },
  { href: "/admin/transfers", label: "Överföringar", description: "Alla överföringar mellan butiker.", group: "admin", searchable: true, visible: (role) => signedIn(role) && canAccessAdmin(role) },
  { href: "/admin/issues", label: "Problemrapporter", description: "Kö, filter och tilldelning.", group: "admin", searchable: true, visible: (role) => signedIn(role) && canAccessAdmin(role) },
  { href: "/admin/routines", label: "Rutiner", description: "Skriv rutiner och hantera kategorier.", group: "admin", searchable: true, visible: (role) => signedIn(role) && canAccessAdmin(role) },
  { href: "/admin/brands", label: "Varumärken", description: "Innehåll på varumärkessidorna.", group: "admin", searchable: true, visible: (role) => signedIn(role) && canAccessAdmin(role) },
  { href: "/admin/checklists", label: "Checklistor", description: "Mallar och dagens status.", group: "admin", searchable: true, visible: (role) => signedIn(role) && canAccessAdmin(role) },
  { href: "/admin/quizzes", label: "Quiz", description: "Frågor och resultat.", group: "admin", searchable: true, visible: (role) => signedIn(role) && canAccessAdmin(role) },
  { href: "/admin/flavor-tags", label: "Utan smakgrupp", description: "Sortera produkter som ingen regel träffade.", group: "admin", searchable: true, visible: (role) => signedIn(role) && canAccessAdmin(role) },
  { href: "/admin/users", label: "Konton", description: "Skapa konton och koppla butiker.", group: "admin", searchable: true, visible: (role) => signedIn(role) && canAccessAdmin(role) },
  { href: "/admin/schedule", label: "Schema", description: "Importera pass.", group: "admin", searchable: true, visible: (role) => signedIn(role) && canAccessAdmin(role) },
  { href: "/admin/announcements", label: "Nyheter", description: "Skriv och publicera.", group: "admin", searchable: true, visible: (role) => signedIn(role) && canAccessAdmin(role) },
  { href: "/admin/tooeasy", label: "TooEasy", description: "Schemakoppling och status.", group: "admin", searchable: true, visible: (role) => signedIn(role) && canAccessAdmin(role) },
];

export function navFor(role: Role | null): NavEntry[] {
  return NAV_ENTRIES.filter((entry) => entry.visible(role));
}

/** The subset the desktop header bar shows; the menu still lists everything. */
export function primaryNavFor(role: Role | null): NavEntry[] {
  return navFor(role).filter((entry) => entry.primary);
}

/** Everything a role may reach — the basis for a future global search. */
export function searchableFor(role: Role | null): NavEntry[] {
  return [...NAV_ENTRIES, ...ADMIN_ENTRIES].filter(
    (entry) => entry.searchable && entry.visible(role)
  );
}
