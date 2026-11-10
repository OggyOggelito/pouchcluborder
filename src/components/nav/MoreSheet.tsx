"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import NavIcon from "@/components/nav/NavIcon";
import { activeHref, type NavEntry, type NavGroup } from "@/config/navigation";

export type NavSection = { group: NavGroup; label: string; entries: NavEntry[] };

/**
 * Everything that does not fit in the bottom bar.
 *
 * A bottom sheet rather than a dropdown: on a phone the thumb is at the bottom
 * of the screen, and the list is long enough to need to scroll. Escape and a
 * tap on the backdrop both close it, and the body is locked while it is open
 * so the page behind does not scroll away under the sheet.
 */
export default function MoreSheet({
  sections,
  signOut,
  newsBadge,
}: {
  sections: NavSection[];
  /** The sign-out form, rendered on the server so the action stays server-side. */
  signOut: React.ReactNode;
  newsBadge: number;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const titleId = useId();

  const allEntries = sections.flatMap((section) => section.entries);
  const current = activeHref(pathname, allEntries);

  // Any navigation closes it — the sheet is a menu, not a destination.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-muted transition active:bg-raised"
      >
        <NavIcon name="settings" className="h-6 w-6" />
        <span className="text-[11px] font-medium leading-none">Mer</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Stäng menyn"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-scrim"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-surface pb-[env(safe-area-inset-bottom)] shadow-2xl"
          >
            <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3">
              <h2 id={titleId} className="text-lg font-semibold tracking-tight">
                Meny
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-11 w-11 place-items-center rounded-xl text-muted transition active:bg-raised"
                aria-label="Stäng menyn"
              >
                <span aria-hidden className="text-xl leading-none">
                  ✕
                </span>
              </button>
            </div>

            <div className="px-3 pb-4 pt-2">
              {sections.map((section) => (
                <section key={section.group} className="pb-2">
                  <h3 className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted">
                    {section.label}
                  </h3>
                  <ul>
                    {section.entries.map((entry) => (
                      <li key={entry.href}>
                        <Link
                          href={entry.href}
                          aria-current={current === entry.href ? "page" : undefined}
                          className={`relative flex min-h-[3rem] items-center gap-3 rounded-xl py-1 pl-4 pr-3 text-[15px] transition active:bg-raised ${
                            current === entry.href ? "bg-raised font-bold text-ink" : "text-ink"
                          }`}
                        >
                          {current === entry.href ? (
                            <span
                              aria-hidden
                              className="absolute inset-y-1 left-0 w-[3px] rounded-full bg-primary"
                            />
                          ) : null}
                          <NavIcon name={entry.icon} className="h-5 w-5 shrink-0 text-muted" />
                          <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                          {entry.href === "/news" && newsBadge > 0 ? (
                            <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-on-primary">
                              {newsBadge}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}

              <div className="mt-2 border-t border-line pt-2">{signOut}</div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
