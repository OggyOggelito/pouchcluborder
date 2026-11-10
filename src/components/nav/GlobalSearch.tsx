"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import NavIcon from "@/components/nav/NavIcon";
import { globalSearchAction } from "@/lib/search-actions";
import { MIN_QUERY_LENGTH, groupHits, type SearchHit } from "@/lib/search";

const RECENT_KEY = "pc.recentSearches";
const MAX_RECENT = 5;

/**
 * Reads the recent-search list.
 *
 * Every access is wrapped: in a private window, with site data blocked, or
 * inside an embedded webview, touching localStorage can throw rather than
 * return null. Recent searches are a convenience and must never be the reason
 * the header stops working.
 */
function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeRecent(values: string[]) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(values.slice(0, MAX_RECENT)));
  } catch {
    // Nothing to do and nothing worth telling the user about.
  }
}

/**
 * Search across products, brands, news, routines and pages.
 *
 * A magnifier in the header at every width; on desktop "/" opens it too, the
 * way the order list's own search behaves. Results are grouped and the whole
 * thing is a dialog, so Escape closes it and the page behind does not scroll.
 */
export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [pending, startSearch] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const titleId = useId();

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setHits([]);
  }, []);

  useEffect(() => {
    close();
  }, [pathname, close]);

  // "/" opens search, unless the person is typing into something.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && open) {
        close();
        return;
      }
      if (event.key !== "/" || open) return;

      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable === true;
      if (typing) return;

      event.preventDefault();
      setOpen(true);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    setRecent(readRecent());
    inputRef.current?.focus();

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Debounced, so a fast typist sends one query rather than eight.
  useEffect(() => {
    if (!open) return;
    if (query.trim().length < MIN_QUERY_LENGTH) {
      setHits([]);
      return;
    }

    const timer = setTimeout(() => {
      startSearch(async () => {
        setHits(await globalSearchAction(query));
      });
    }, 200);

    return () => clearTimeout(timer);
  }, [query, open]);

  function remember(value: string) {
    const trimmed = value.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) return;
    const next = [trimmed, ...recent.filter((item) => item !== trimmed)].slice(0, MAX_RECENT);
    setRecent(next);
    writeRecent(next);
  }

  function openHit(hit: SearchHit) {
    remember(query);
    close();
    router.push(hit.href);
  }

  const sections = groupHits(hits);
  const searched = query.trim().length >= MIN_QUERY_LENGTH;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="grid h-11 w-11 place-items-center rounded-xl text-muted transition hover:bg-raised"
      >
        <NavIcon name="search" className="h-5 w-5" />
        <span className="sr-only">Sök</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Stäng sök"
            onClick={close}
            className="absolute inset-0 bg-scrim"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="absolute inset-x-0 top-0 mx-auto flex max-h-[90dvh] max-w-2xl flex-col overflow-hidden bg-surface shadow-2xl sm:mt-10 sm:rounded-3xl"
          >
            <h2 id={titleId} className="sr-only">
              Sök i appen
            </h2>

            <div className="flex items-center gap-2 border-b border-line px-3 py-2">
              <NavIcon name="search" className="h-5 w-5 shrink-0 text-muted" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Sök produkter, märken, nyheter, rutiner…"
                aria-label="Sök produkter, märken, nyheter och rutiner"
                className="h-11 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-muted outline-none"
              />
              <button
                type="button"
                onClick={close}
                className="h-11 shrink-0 rounded-xl px-3 text-sm font-medium text-muted transition hover:bg-raised"
              >
                Avbryt
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
              {!searched ? (
                recent.length > 0 ? (
                  <section>
                    <h3 className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">
                      Senaste sökningar
                    </h3>
                    <ul>
                      {recent.map((item) => (
                        <li key={item}>
                          <button
                            type="button"
                            onClick={() => setQuery(item)}
                            className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-[15px] text-ink transition hover:bg-raised"
                          >
                            {item}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : (
                  <p className="px-3 py-6 text-center text-sm text-muted">
                    Skriv minst {MIN_QUERY_LENGTH} tecken.
                  </p>
                )
              ) : pending && sections.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted">Söker…</p>
              ) : sections.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <p className="text-sm text-muted">
                    Inget matchade <span className="font-medium">”{query.trim()}”</span>.
                  </p>
                  <Link
                    href={`/requests/new?q=${encodeURIComponent(query.trim())}`}
                    onClick={close}
                    className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-control px-4 text-sm font-medium"
                  >
                    Logga som kundönskemål
                  </Link>
                </div>
              ) : (
                sections.map((section) => (
                  <section key={section.group}>
                    <h3 className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted">
                      {section.label}
                    </h3>
                    <ul>
                      {section.hits.map((hit) => (
                        <li key={`${hit.group}:${hit.href}:${hit.title}`}>
                          <button
                            type="button"
                            onClick={() => openHit(hit)}
                            className="flex min-h-12 w-full flex-col justify-center rounded-xl px-3 py-1.5 text-left transition hover:bg-raised"
                          >
                            <span className="truncate text-[15px] text-ink">{hit.title}</span>
                            {hit.subtitle ? (
                              <span className="truncate text-xs text-muted">{hit.subtitle}</span>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
