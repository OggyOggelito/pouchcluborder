"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveBrandAction, type BrandFormState } from "@/lib/admin-actions";
import type { BrandDetail } from "@/lib/repositories/brands";

const FIELD =
  "mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-[15px] outline-none transition focus:border-zinc-400";

export default function BrandEditor({ brand }: { brand: BrandDetail }) {
  const [state, formAction, pending] = useActionState<BrandFormState, FormData>(saveBrandAction, {
    error: null,
    savedAt: null,
  });

  return (
    <form action={formAction} className="mt-6 space-y-5">
      <input type="hidden" name="id" value={brand.id} />

      <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
        <input
          type="checkbox"
          name="published"
          defaultChecked={brand.published}
          className="h-5 w-5 rounded border-zinc-300"
        />
        <span>
          <span className="block font-medium">Publicerad</span>
          <span className="block text-sm text-zinc-500">
            Avbockad = utkast, syns inte i varumärkesguiden.
          </span>
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ursprungsland" name="countryOfOrigin" defaultValue={brand.countryOfOrigin} />
        <Field
          label="Tillverkar-/distributörskod"
          name="manufacturerCode"
          defaultValue={brand.manufacturerCode}
          hint="Internt, t.ex. LUNA"
        />
        <Field label="Logotyp-URL" name="logoUrl" defaultValue={brand.logoUrl} />
        <Field label="Bild-URL (toppbild)" name="heroImageUrl" defaultValue={brand.heroImageUrl} />
      </div>

      <Field label="Webbplats" name="websiteUrl" defaultValue={brand.websiteUrl} />

      <div>
        <label htmlFor="shortDescription" className="block text-sm font-medium text-zinc-700">
          Kort beskrivning
        </label>
        <p className="text-sm text-zinc-500">Ett stycke: vad märket är och hur det positionerar sig.</p>
        <textarea
          id="shortDescription"
          name="shortDescription"
          rows={3}
          defaultValue={brand.shortDescription ?? ""}
          className={FIELD}
        />
      </div>

      <MarkdownField
        label="Så tillverkas de"
        name="manufacturingProcess"
        defaultValue={brand.manufacturingProcess}
      />
      <MarkdownField
        label="Blandning och dosering"
        name="blendingNotes"
        defaultValue={brand.blendingNotes}
      />

      {state.error ? (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}
      {state.savedAt ? (
        <p role="status" className="rounded-xl bg-brand-50 p-3 text-sm text-brand-700">
          Sparat.{" "}
          <Link href={`/staff/brands/${brand.slug}`} className="underline underline-offset-4">
            Visa sidan
          </Link>
        </p>
      ) : null}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="h-12 flex-1 rounded-2xl bg-zinc-900 px-6 font-semibold text-white transition active:scale-[0.99] disabled:bg-zinc-200 disabled:text-zinc-400"
        >
          {pending ? "Sparar…" : "Spara"}
        </button>
        <Link
          href="/admin/brands"
          className="flex h-12 items-center rounded-2xl border border-zinc-200 px-5 font-medium transition hover:bg-zinc-50"
        >
          Tillbaka
        </Link>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  hint,
}: {
  label: string;
  name: string;
  defaultValue: string | null;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-zinc-700">
        {label}
      </label>
      <input id={name} name={name} defaultValue={defaultValue ?? ""} className={FIELD} />
      {hint ? <p className="mt-1 text-xs text-zinc-400">{hint}</p> : null}
    </div>
  );
}

function MarkdownField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: string | null;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-zinc-700">
        {label}
      </label>
      <p className="text-sm text-zinc-500">
        Markdown: <code className="font-mono">##</code> rubrik,{" "}
        <code className="font-mono">-</code> punktlista, <code className="font-mono">**fet**</code>.
      </p>
      <textarea
        id={name}
        name={name}
        rows={12}
        defaultValue={defaultValue ?? ""}
        className={`${FIELD} font-mono text-sm`}
      />
    </div>
  );
}
