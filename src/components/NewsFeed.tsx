"use client";

import { useMemo, useState } from "react";
import Markdown from "@/components/Markdown";
import { ANNOUNCEMENT_CATEGORIES, CATEGORY_LABELS, categoryLabel } from "@/lib/announcements";
import type { AnnouncementRecord } from "@/lib/repositories/announcements";

type Item = Omit<AnnouncementRecord, "publishedAt" | "updatedAt"> & {
  publishedAt: string | null;
  updatedAt: string;
};

export default function NewsFeed({ items }: { items: Item[] }) {
  const [category, setCategory] = useState<string | null>(null);

  const present = useMemo(
    () => ANNOUNCEMENT_CATEGORIES.filter((name) => items.some((item) => item.category === name)),
    [items]
  );

  const visible = useMemo(
    () => (category ? items.filter((item) => item.category === category) : items),
    [items, category]
  );

  return (
    <>
      {present.length > 1 ? (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          <Chip active={category === null} onClick={() => setCategory(null)}>
            Alla
          </Chip>
          {present.map((name) => (
            <Chip
              key={name}
              active={category === name}
              onClick={() => setCategory(category === name ? null : name)}
            >
              {CATEGORY_LABELS[name]}
            </Chip>
          ))}
        </div>
      ) : null}

      {visible.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-control p-6 text-center text-muted">
          Inga inlägg i den kategorin.
        </p>
      ) : (
        <ul className="mt-5 space-y-4">
          {visible.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-line bg-surface p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                {item.pinned ? (
                  <span className="rounded-full bg-raised px-2 py-0.5 text-xs font-medium text-warning">
                    📌 Fäst
                  </span>
                ) : null}
                <span className="rounded-full bg-raised px-2 py-0.5 text-xs text-muted">
                  {categoryLabel(item.category)}
                </span>
                {item.publishedAt ? (
                  <time className="text-xs text-muted" dateTime={item.publishedAt}>
                    {new Date(item.publishedAt).toLocaleDateString("sv-SE", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </time>
                ) : null}
              </div>

              <h2 className="mt-2 text-xl font-semibold tracking-tight">{item.title}</h2>

              <div className="mt-3">
                <Markdown>{item.body}</Markdown>
              </div>

              {item.authorName ? (
                <p className="mt-4 text-xs text-muted">{item.authorName}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-tap shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition ${
        active
          ? "border-primary bg-raised font-semibold text-ink ring-1 ring-primary"
          : "border-control bg-surface text-muted hover:border-control"
      }`}
    >
      {children}
    </button>
  );
}
