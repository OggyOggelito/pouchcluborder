/**
 * Announcement categories. A string like roles, so a fourth category needs no
 * migration — add it here and to the labels below.
 */
export const ANNOUNCEMENT_CATEGORIES = ["NewProduct", "NewStore", "General"] as const;

export type AnnouncementCategory = (typeof ANNOUNCEMENT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<AnnouncementCategory, string> = {
  NewProduct: "Ny produkt",
  NewStore: "Ny butik",
  General: "Allmänt",
};

export function isAnnouncementCategory(value: unknown): value is AnnouncementCategory {
  return (
    typeof value === "string" &&
    (ANNOUNCEMENT_CATEGORIES as readonly string[]).includes(value)
  );
}

export function toCategory(value: unknown): AnnouncementCategory {
  return isAnnouncementCategory(value) ? value : "General";
}

export function categoryLabel(value: string): string {
  return isAnnouncementCategory(value) ? CATEGORY_LABELS[value] : value;
}
