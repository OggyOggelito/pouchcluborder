"use client";

import { useActionState } from "react";
import {
  createSupplierAction,
  reissueLinkAction,
  type SupplierAdminState,
} from "@/lib/supplier-admin-actions";

/**
 * Creating a supplier account, and re-issuing a link for one.
 *
 * The link is shown once, right here, and never stored: the token is kept as
 * a hash, which is the point. This app has no mail transport, so an admin
 * copies the link into whatever they already use to talk to the supplier —
 * see docs/supplier-portal.md for why that is a deliberate gap and not an
 * oversight.
 */
function LinkBox({ link }: { link: string }) {
  const url = typeof window === "undefined" ? link : `${window.location.origin}${link}`;
  return (
    <div className="mt-3 rounded-xl border border-success bg-raised p-3">
      <p className="text-sm font-medium text-success">
        <span aria-hidden="true">✓ </span>Länken är giltig i 72 timmar och kan användas en gång.
      </p>
      <p className="mt-2 break-all font-mono text-xs text-ink">{url}</p>
      <p className="mt-2 text-xs text-muted">
        Kopiera den nu — den går inte att visa igen. Skicka den på det sätt ni redan pratar med
        leverantören.
      </p>
    </div>
  );
}

export function CreateSupplierForm({ brands }: { brands: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<SupplierAdminState, FormData>(
    createSupplierAction,
    { error: null, link: null }
  );

  return (
    <form action={formAction} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <h2 className="font-semibold tracking-tight">Nytt leverantörskonto</h2>

      <label className="mt-3 block text-sm">
        <span className="block font-medium">E-post</span>
        <input
          name="email"
          type="email"
          required
          className="mt-1 min-h-tap w-full rounded-xl border border-control bg-raised px-3"
        />
      </label>

      <label className="mt-3 block text-sm">
        <span className="block font-medium">Namn (frivilligt)</span>
        <input
          name="name"
          className="mt-1 min-h-tap w-full rounded-xl border border-control bg-raised px-3"
        />
        <span className="mt-1 block text-xs text-muted">
          Bara för att känna igen kontot. Inga andra uppgifter om personen sparas.
        </span>
      </label>

      <label className="mt-3 block text-sm">
        <span className="block font-medium">Varumärke</span>
        <select
          name="brandId"
          required
          className="mt-1 min-h-tap w-full rounded-xl border border-control bg-raised px-3"
        >
          {brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-muted">
          Kontot ser bara det här varumärket. Det går inte att ändra till flera.
        </span>
      </label>

      {state.error ? (
        <p role="alert" className="mt-3 rounded-xl border border-danger bg-raised p-3 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      {state.link ? <LinkBox link={state.link} /> : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 min-h-tap w-full rounded-2xl bg-primary px-4 font-semibold text-on-primary transition active:scale-[0.99] disabled:opacity-50"
      >
        {pending ? "Skapar…" : "Skapa konto och länk"}
      </button>
    </form>
  );
}

export function ReissueLinkForm({ id, kind }: { id: string; kind: "INVITE" | "RESET" }) {
  const [state, formAction, pending] = useActionState<SupplierAdminState, FormData>(
    reissueLinkAction,
    { error: null, link: null }
  );

  return (
    <form action={formAction} className="mt-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="kind" value={kind} />
      <button
        type="submit"
        disabled={pending}
        className="min-h-tap w-full rounded-2xl border border-control px-4 text-sm font-medium transition hover:bg-raised disabled:opacity-50"
      >
        {pending
          ? "Skapar…"
          : kind === "INVITE"
            ? "Skapa ny inbjudningslänk"
            : "Skapa återställningslänk"}
      </button>
      {state.link ? <LinkBox link={state.link} /> : null}
    </form>
  );
}
