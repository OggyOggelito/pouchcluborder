"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/lib/auth-actions";

export default function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {
    error: null,
  });

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-ink">
          E-post
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          className="mt-1 h-12 w-full bg-raised rounded-2xl border border-control px-4 text-base text-ink placeholder:text-muted outline-none transition focus:border-primary"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-ink">
          Lösenord
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 h-12 w-full bg-raised rounded-2xl border border-control px-4 text-base text-ink placeholder:text-muted outline-none transition focus:border-primary"
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
        {pending ? "Loggar in…" : "Logga in"}
      </button>
    </form>
  );
}
