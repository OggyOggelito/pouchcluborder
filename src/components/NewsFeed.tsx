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
        <p className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-zinc-500">
          Inga inlägg i den kategorin.
        </p>
      ) : (
        <ul className="mt-5 space-y-4">
          {visible.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                {item.pinned ? (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                    📌 Fäst
                  </span>
                ) : null}
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                  {categoryLabel(item.category)}
                </span>
                {item.publishedAt ? (
                  <time className="text-xs text-zinc-400" dateTime={item.publishedAt}>
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
                <p className="mt-4 text-xs text-zinc-400">{item.authorName}</p>
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
      className={`h-9 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition ${
        active
          ? "border-zinc-900 bg-zinc-900 text-white"
          : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
      }`}
    >
      {children}
    </button>
  );
}
