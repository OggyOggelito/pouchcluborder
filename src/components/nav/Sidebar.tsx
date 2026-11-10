"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import NavIcon from "@/components/nav/NavIcon";
import type { NavSection } from "@/components/nav/MoreSheet";
import { activeHref } from "@/config/navigation";

/**
 * The desktop navigation: the same groups as the "Mer" sheet, always open.
 *
 * Sticky rather than fixed, so a long admin page scrolls the sidebar out of
 * the way instead of trapping it against a short viewport.
 */
export default function Sidebar({
  sections,
  signOut,
  newsBadge,
}: {
  sections: NavSection[];
  signOut: React.ReactNode;
  newsBadge: number;
}) {
  const pathname = usePathname();
  const current = activeHref(
    pathname,
    sections.flatMap((section) => section.entries)
  );

  return (
    <aside className="hidden w-60 shrink-0 lg:block">
      <nav
        aria-label="Huvudmeny"
        className="sticky top-[57px] max-h-[calc(100dvh-57px)] overflow-y-auto px-3 py-4"
      >
        {sections.map((section) => (
          <section key={section.group} className="pb-3">
            <h2 className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">
              {section.label}
            </h2>
            <ul className="space-y-0.5">
              {section.entries.map((entry) => {
                const active = current === entry.href;
                return (
                  <li key={entry.href}>
                    <Link
                      href={entry.href}
                      aria-current={active ? "page" : undefined}
                      className={`relative flex min-h-11 items-center gap-3 rounded-xl py-1 pl-4 pr-3 text-[15px] transition ${
                        active ? "bg-raised font-bold text-ink" : "text-ink hover:bg-raised"
                      }`}
                    >
                      {active ? (
                        <span
                          aria-hidden
                          className="absolute inset-y-1 left-0 w-[3px] rounded-full bg-primary"
                        />
                      ) : null}
                      <NavIcon
                        name={entry.icon}
                        className={`h-5 w-5 shrink-0 ${active ? "text-primary" : "text-muted"}`}
                      />
                      <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                      {entry.href === "/news" && newsBadge > 0 ? (
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                            "bg-primary text-on-primary"
                          }`}
                        >
                          {newsBadge}
                          <span className="sr-only"> olästa nyheter</span>
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        <div className="border-t border-line pt-2">{signOut}</div>
      </nav>
    </aside>
  );
}
