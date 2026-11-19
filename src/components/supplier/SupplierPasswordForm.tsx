"use client";

import { useActionState } from "react";
import {
  activateSupplierAction,
  changeSupplierPasswordAction,
  type SupplierPasswordState,
} from "@/lib/supplier-auth-actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwords";

/**
 * One form for both "choose a password from a link" and "change the one I
 * have". The only difference is which action it posts to, and whether it
 * carries a token.
 */
export default function SupplierPasswordForm({ token }: { token?: string }) {
  const action = token ? activateSupplierAction : changeSupplierPasswordAction;
  const [state, formAction, pending] = useActionState<SupplierPasswordState, FormData>(action, {
    error: null,
  });

  return (
    <form action={formAction} className="mt-6 space-y-4">
      {token ? <input type="hidden" name="token" value={token} /> : null}

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-ink">
          Nytt lösenord
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          className="mt-1 h-12 w-full rounded-2xl border border-control bg-raised px-4 text-base text-ink outline-none transition focus:border-primary"
        />
        <p className="mt-1 text-xs text-muted">
          Minst {MIN_PASSWORD_LENGTH} tecken. En mening du kommer ihåg är både lättare och
          säkrare än ett kort krångligt lösenord.
        </p>
      </div>

      <div>
        <label htmlFor="repeat" className="block text-sm font-medium text-ink">
          Upprepa lösenordet
        </label>
        <input
          id="repeat"
          name="repeat"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          className="mt-1 h-12 w-full rounded-2xl border border-control bg-raised px-4 text-base text-ink outline-none transition focus:border-primary"
        />
      </div>

      {state.error ? (
        <p role="alert" className="rounded-xl bg-raised p-3 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-2xl bg-primary px-6 font-semibold text-on-primary transition active:scale-[0.99] disabled:bg-raised disabled:text-muted"
      >
        {pending ? "Sparar…" : "Spara lösenordet"}
      </button>
    </form>
  );
}
