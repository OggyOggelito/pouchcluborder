"use client";

import { useActionState } from "react";
import {
  deleteAnnouncementAction,
  saveAnnouncementAction,
  type AnnouncementFormState,
} from "@/lib/announcement-actions";
import { ANNOUNCEMENT_CATEGORIES, CATEGORY_LABELS } from "@/lib/announcements";
import type { AnnouncementRecord } from "@/lib/repositories/announcements";

const FIELD =
  "mt-1 w-full bg-raised rounded-xl border border-control px-3 py-2 text-[15px] text-ink placeholder:text-muted outline-none transition focus:border-primary";

export default function AnnouncementEditor({
  announcement,
}: {
  announcement?: AnnouncementRecord;
}) {
  const [state, formAction, pending] = useActionState<AnnouncementFormState, FormData>(
    saveAnnouncementAction,
    { error: null, message: null }
  );

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <h2 className="text-lg font-semibold tracking-tight">
        {announcement ? "Redigera" : "Nytt inlägg"}
      </h2>

      <form action={formAction} className="mt-4 space-y-4">
        {announcement ? <input type="hidden" name="id" value={announcement.id} /> : null}

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-ink">
            Rubrik
          </label>
          <input
            id="title"
            name="title"
            required
            defaultValue={announcement?.title ?? ""}
            className={FIELD}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-ink">
              Kategori
            </label>
            <select
              id="category"
              name="category"
              defaultValue={announcement?.category ?? "General"}
              className={FIELD}
            >
              {ANNOUNCEMENT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-4 pb-1">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="pinned"
                defaultChecked={announcement?.pinned ?? false}
                className="h-5 w-5 rounded border-control"
              />
              <span className="text-sm">Fäst överst</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="publish"
                defaultChecked={announcement ? announcement.publishedAt !== null : true}
                className="h-5 w-5 rounded border-control"
              />
              <span className="text-sm">Publicerad</span>
            </label>
          </div>
        </div>

        <div>
          <label htmlFor="body" className="block text-sm font-medium text-ink">
            Innehåll
          </label>
          <p className="text-sm text-muted">
            Markdown: <code className="font-mono">##</code> rubrik,{" "}
            <code className="font-mono">-</code> punktlista,{" "}
            <code className="font-mono">**fet**</code>.
          </p>
          <textarea
            id="body"
            name="body"
            rows={12}
            required
            defaultValue={announcement?.body ?? ""}
            className={`${FIELD} font-mono text-sm`}
          />
        </div>

        {state.error ? (
          <p role="alert" className="rounded-xl bg-raised p-3 text-sm text-danger">
            {state.error}
          </p>
        ) : null}
        {state.message ? (
          <p role="status" className="rounded-xl bg-raised p-3 text-sm text-primary">
            {state.message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="h-12 w-full rounded-2xl bg-primary px-6 font-semibold text-on-primary transition active:scale-[0.99] disabled:bg-raised disabled:text-muted"
        >
          {pending ? "Sparar…" : "Spara"}
        </button>
      </form>

      {announcement ? (
        <form action={deleteAnnouncementAction} className="mt-3">
          <input type="hidden" name="id" value={announcement.id} />
          <button
            type="submit"
            className="min-h-tap w-full rounded-xl border border-danger text-sm font-medium text-danger transition hover:bg-raised"
          >
            Ta bort inlägget
          </button>
        </form>
      ) : null}
    </section>
  );
}
