"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import Markdown from "@/components/Markdown";
import { saveArticleAction, type ArticleFormState } from "@/lib/knowledge-actions";
import { MAX_ARTICLE_TITLE_LENGTH } from "@/lib/knowledge";
import { NO_PERSONAL_DATA_SHORT } from "@/lib/privacy";
import type { ArticleDetail } from "@/lib/repositories/knowledge";

const FIELD =
  "mt-1 w-full bg-raised rounded-xl border border-control px-3 py-2 text-[15px] text-ink placeholder:text-muted outline-none transition focus:border-primary";

/**
 * The routine editor: markdown in, preview beside it, publish toggle.
 *
 * The preview renders with the same `Markdown` component the staff page uses,
 * so what is previewed is what ships — a second renderer would drift.
 */
export default function RoutineEditor({
  article,
  categories,
}: {
  /** Null when creating a new article. */
  article: ArticleDetail | null;
  categories: string[];
}) {
  const [body, setBody] = useState(article?.body ?? "");
  const [preview, setPreview] = useState(false);

  const [state, formAction, pending] = useActionState<ArticleFormState, FormData>(
    saveArticleAction,
    { error: null, savedAt: null }
  );

  return (
    <form action={formAction} className="mt-6 space-y-5">
      {article ? <input type="hidden" name="id" value={article.id} /> : null}

      <div>
        <label htmlFor="title" className="block text-sm font-medium text-ink">
          Rubrik
        </label>
        <input
          id="title"
          name="title"
          defaultValue={article?.title ?? ""}
          maxLength={MAX_ARTICLE_TITLE_LENGTH}
          required
          className={FIELD}
        />
        {article ? (
          <p className="mt-1 text-sm text-muted">
            Adressen är <span className="font-mono">/staff/routines/{article.slug}</span> och
            ändras inte när rubriken ändras, så länkar till rutinen fortsätter fungera.
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="category" className="block text-sm font-medium text-ink">
          Kategori
        </label>
        <input
          id="category"
          name="category"
          defaultValue={article?.category ?? ""}
          list="routine-categories"
          placeholder="Ingen kategori"
          className={FIELD}
        />
        <datalist id="routine-categories">
          {categories.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <p className="mt-1 text-sm text-muted">
          Välj en befintlig kategori eller skriv en ny. Kategorierna som visas som chips på
          personalsidan hanteras längst ned på{" "}
          <Link href="/admin/routines" className="underline underline-offset-4">
            översikten
          </Link>
          .
        </p>
      </div>

      <label className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
        <input
          type="checkbox"
          name="published"
          defaultChecked={article?.published ?? false}
          className="h-5 w-5 rounded border-control"
        />
        <span>
          <span className="block font-medium">Publicerad</span>
          <span className="block text-sm text-muted">
            Avbockad = utkast, syns bara för administratörer.
          </span>
        </span>
      </label>

      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <label htmlFor="body" className="block text-sm font-medium text-ink">
            Innehåll (Markdown)
          </label>
          <button
            type="button"
            onClick={() => setPreview((current) => !current)}
            aria-pressed={preview}
            className="h-9 rounded-xl border border-control px-3 text-sm font-medium"
          >
            {preview ? "Redigera" : "Förhandsgranska"}
          </button>
        </div>

        {preview ? (
          <div className="mt-1 rounded-xl border border-line bg-surface p-4">
            {body.trim() ? (
              <Markdown>{body}</Markdown>
            ) : (
              <p className="text-sm text-muted">Inget att visa än.</p>
            )}
          </div>
        ) : (
          <textarea
            id="body"
            name="body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={18}
            required
            className={`${FIELD} font-mono text-sm`}
          />
        )}
        {/* The textarea is unmounted while previewing, so the value needs to
            survive the submit either way. */}
        {preview ? <input type="hidden" name="body" value={body} /> : null}
        <p className="mt-1 text-sm text-muted">{NO_PERSONAL_DATA_SHORT}</p>
      </div>

      {state.error ? (
        <p role="alert" className="rounded-xl bg-raised p-3 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state.savedAt ? (
        <p role="status" className="rounded-xl bg-raised p-3 text-sm text-primary">
          Sparat.{" "}
          {article ? (
            <Link href={`/staff/routines/${article.slug}`} className="underline underline-offset-4">
              Visa sidan
            </Link>
          ) : null}
        </p>
      ) : null}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="h-12 flex-1 rounded-2xl bg-primary px-6 font-semibold text-on-primary transition active:scale-[0.99] disabled:bg-raised disabled:text-muted"
        >
          {pending ? "Sparar…" : "Spara"}
        </button>
        <Link
          href="/admin/routines"
          className="flex h-12 items-center rounded-2xl border border-control px-5 font-medium transition hover:bg-raised"
        >
          Tillbaka
        </Link>
      </div>
    </form>
  );
}
