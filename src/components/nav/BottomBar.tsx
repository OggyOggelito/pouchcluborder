"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import NavIcon from "@/components/nav/NavIcon";
import MoreSheet, { type NavSection } from "@/components/nav/MoreSheet";
import { activeHref, type NavEntry } from "@/config/navigation";

/**
 * The phone navigation: four destinations and "Mer".
 *
 * Fixed to the bottom because that is where the thumb is, and padded for the
 * home indicator. Hidden from `lg` up, where the sidebar takes over.
 */
export default function BottomBar({
  entries,
  sections,
  signOut,
  newsBadge,
}: {
  entries: NavEntry[];
  sections: NavSection[];
  signOut: React.ReactNode;
  newsBadge: number;
}) {
  const pathname = usePathname();
  const current = activeHref(pathname, entries);

  return (
    <nav
      aria-label="Huvudmeny"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-3xl items-stretch gap-1 px-2 py-1">
        {entries.map((entry) => {
          const active = current === entry.href;
          return (
            <li key={entry.href} className="flex flex-1">
              <Link
                href={entry.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl transition active:bg-raised ${
                  active ? "bg-raised text-ink" : "text-muted"
                }`}
              >
                {/* A 3px bar, not just a colour change: on this background
                    almost everything is already yellow. */}
                {active ? (
                  <span
                    aria-hidden
                    className="absolute inset-x-3 top-0 h-[3px] rounded-full bg-primary"
                  />
                ) : null}
                <NavIcon name={entry.icon} className="h-6 w-6" />
                <span
                  className={`text-[11px] leading-none ${active ? "font-bold" : "font-medium"}`}
                >
                  {entry.label}
                </span>

                {entry.href === "/news" && newsBadge > 0 ? (
                  <span
                    aria-hidden
                    className="absolute right-[18%] top-1 min-w-5 rounded-full bg-primary px-1 text-center text-[10px] font-bold leading-5 text-on-primary"
                  >
                    {newsBadge > 9 ? "9+" : newsBadge}
                  </span>
                ) : null}
                {entry.href === "/news" && newsBadge > 0 ? (
                  <span className="sr-only">{newsBadge} olästa nyheter</span>
                ) : null}
              </Link>
            </li>
          );
        })}

        <li className="flex flex-1">
          <MoreSheet sections={sections} signOut={signOut} newsBadge={newsBadge} />
        </li>
      </ul>
    </nav>
  );
}
