"use client";

import { useActionState } from "react";
import {
  createUserAction,
  setPasswordAction,
  setStoreAccessAction,
  type UserFormState,
} from "@/lib/admin-actions";
import type { StoreSummary } from "@/lib/repositories/stores";
import type { UserRecord } from "@/lib/repositories/users";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES } from "@/lib/roles";

const FIELD =
  "mt-1 w-full bg-raised rounded-xl border border-control px-3 py-2 text-[15px] text-ink placeholder:text-muted outline-none transition focus:border-primary";

export default function UserAdmin({
  users,
  stores,
}: {
  users: UserRecord[];
  stores: StoreSummary[];
}) {
  const [createState, createAction, creating] = useActionState<UserFormState, FormData>(
    createUserAction,
    { error: null, message: null }
  );
  const [passwordState, passwordAction, savingPassword] = useActionState<UserFormState, FormData>(
    setPasswordAction,
    { error: null, message: null }
  );

  return (
    <div className="mt-6 space-y-8">
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight">Nytt konto</h2>
        <p className="mt-1 text-sm text-muted">
          Det finns ingen självregistrering — konton skapas här eller av seed-skriptet.
        </p>

        <form action={createAction} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-ink">
                E-post
              </label>
              <input id="email" name="email" type="email" required className={FIELD} />
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-ink">
                Namn (valfritt)
              </label>
              <input id="name" name="name" className={FIELD} />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-ink">
                Lösenord
              </label>
              <input
                id="password"
                name="password"
                type="password"
                minLength={8}
                required
                className={FIELD}
              />
              <p className="mt-1 text-xs text-muted">Minst 8 tecken.</p>
            </div>
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-ink">
                Roll
              </label>
              <select id="role" name="role" defaultValue="STAFF" className={FIELD}>
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]} — {ROLE_DESCRIPTIONS[role]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <StoreCheckboxes stores={stores} selected={[]} />

          {createState.error ? (
            <p role="alert" className="rounded-xl bg-raised p-3 text-sm text-danger">
              {createState.error}
            </p>
          ) : null}
          {createState.message ? (
            <p role="status" className="rounded-xl bg-raised p-3 text-sm text-primary">
              {createState.message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={creating}
            className="h-12 w-full rounded-2xl bg-primary px-6 font-semibold text-on-primary transition active:scale-[0.99] disabled:bg-raised disabled:text-muted"
          >
            {creating ? "Skapar…" : "Skapa konto"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-tight">Konton ({users.length})</h2>
        <ul className="mt-3 space-y-3">
          {users.map((user) => (
            <li key={user.id} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{user.email}</p>
                  <p className="text-sm text-muted">
                    {user.name ? `${user.name} · ` : ""}
                    {ROLE_LABELS[user.role]}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-raised px-2 py-0.5 text-xs text-muted">
                  {user.role === "ADMIN" ? "alla butiker" : `${user.stores.length} butik(er)`}
                </span>
              </div>

              {user.role !== "ADMIN" ? (
                <form action={setStoreAccessAction} className="mt-3">
                  <input type="hidden" name="userId" value={user.id} />
                  <StoreCheckboxes
                    stores={stores}
                    selected={user.stores.map((store) => store.id)}
                    compact
                  />
                  <button
                    type="submit"
                    className="mt-2 min-h-tap rounded-xl border border-control px-4 text-sm font-medium transition hover:bg-raised"
                  >
                    Spara butiker
                  </button>
                </form>
              ) : null}

              <form action={passwordAction} className="mt-3 flex gap-2">
                <input type="hidden" name="userId" value={user.id} />
                <input
                  name="password"
                  type="password"
                  minLength={8}
                  placeholder="Nytt lösenord"
                  aria-label={`Nytt lösenord för ${user.email}`}
                  className="min-h-tap flex-1 bg-raised rounded-xl border border-control px-3 text-sm text-ink placeholder:text-muted outline-none transition focus:border-primary"
                />
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="min-h-tap shrink-0 rounded-xl border border-control px-4 text-sm font-medium transition hover:bg-raised disabled:opacity-50"
                >
                  Byt
                </button>
              </form>
            </li>
          ))}
        </ul>

        {passwordState.error ? (
          <p role="alert" className="mt-3 rounded-xl bg-raised p-3 text-sm text-danger">
            {passwordState.error}
          </p>
        ) : null}
        {passwordState.message ? (
          <p role="status" className="mt-3 rounded-xl bg-raised p-3 text-sm text-primary">
            {passwordState.message}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function StoreCheckboxes({
  stores,
  selected,
  compact = false,
}: {
  stores: StoreSummary[];
  selected: string[];
  compact?: boolean;
}) {
  return (
    <fieldset>
      {!compact ? (
        <legend className="text-sm font-medium text-ink">
          Butiker <span className="text-muted">(krävs för butiksägare)</span>
        </legend>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {stores.map((store) => (
          <label
            key={store.id}
            className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm"
          >
            <input
              type="checkbox"
              name="storeIds"
              value={store.id}
              defaultChecked={selected.includes(store.id)}
              className="h-4 w-4 rounded border-control"
            />
            {store.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
