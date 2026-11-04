import type { NavIconName } from "@/config/navigation";

/**
 * The navigation icon set.
 *
 * Inline stroked paths on a 24-grid rather than an icon package: there are
 * nineteen of them, they never change, and a dependency for nineteen paths is
 * weight on the critical path of every page.
 *
 * Always decorative — every icon sits next to its own text label, so they are
 * hidden from assistive technology.
 */
const PATHS: Record<NavIconName, string> = {
  today: "M4 10 12 4l8 6v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z",
  order: "M4 5h2l2 10h9l2-7H7M9 19a1 1 0 1 0 2 0 1 1 0 0 0-2 0m7 0a1 1 0 1 0 2 0 1 1 0 0 0-2 0",
  guide: "M5 5a2 2 0 0 1 2-2h11v16H7a2 2 0 0 0-2 2zM9 7h6M9 11h6",
  news: "M5 5h11v14H5zM19 8v9a2 2 0 0 1-3 0M8 9h5M8 13h5",
  search: "M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14M16 16l4 4",
  notes: "M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h4",
  issue: "M12 4 3 20h18zM12 10v4M12 17h.01",
  request: "M4 5h16v11H9l-5 4z M9 9h6M9 12h4",
  transfer: "M4 8h13l-3-3M20 16H7l3 3",
  routine: "M7 3h10v18H7zM10 8h4M10 12h4M10 16h2",
  checklist: "M4 6h3l1.5 2L12 4M4 12h3l1.5 2L12 10M4 18h3l1.5 2L12 16M14 6h6M14 12h6M14 18h6",
  quiz: "M12 20a8 8 0 1 1 0-16 8 8 0 0 1 0 16M9.5 9.5a2.5 2.5 0 0 1 4.6 1.3c0 1.7-2.1 2-2.1 3.2M12 17h.01",
  schedule: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  team: "M9 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6M3 20a6 6 0 0 1 12 0M17 11a3 3 0 1 0-1-5.8M21 19a5 5 0 0 0-3-4.6",
  history: "M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4M12 8v4l3 2",
  onboarding: "M12 4 3 8l9 4 9-4zM7 11v4c0 1.5 2.3 3 5 3s5-1.5 5-3v-4",
  bell: "M6 16V11a6 6 0 1 1 12 0v5l2 3H4zM10 19a2 2 0 0 0 4 0",
  settings:
    "M12 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6M19.4 13.5a7.6 7.6 0 0 0 0-3l1.6-1.3-2-3.4-2 .8a7.6 7.6 0 0 0-2.6-1.5L14 3h-4l-.4 2.1A7.6 7.6 0 0 0 7 6.6l-2-.8-2 3.4 1.6 1.3a7.6 7.6 0 0 0 0 3L3 14.8l2 3.4 2-.8a7.6 7.6 0 0 0 2.6 1.5L10 21h4l.4-2.1a7.6 7.6 0 0 0 2.6-1.5l2 .8 2-3.4z",
  admin: "M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6zM9 12l2 2 4-4",
  logout: "M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 8l-4 4 4 4M6 12h10",
};

export default function NavIcon({
  name,
  className = "h-6 w-6",
}: {
  name: NavIconName;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
