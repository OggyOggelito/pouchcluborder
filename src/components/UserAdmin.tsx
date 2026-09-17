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
import { ROLE_LABELS, ROLES } from "@/lib/roles";

const FIELD =
  "mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-[15px] outline-none transition focus:border-zinc-400";

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
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight">Nytt konto</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Det finns ingen självregistrering — konton skapas här eller av seed-skriptet.
        </p>

        <form action={createAction} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
                E-post
              </label>
              <input id="email" name="email" type="email" required className={FIELD} />
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-zinc-700">
                Namn (valfritt)
              </label>
              <input id="name" name="name" className={FIELD} />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-700">
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
              <p className="mt-1 text-xs text-zinc-400">Minst 8 tecken.</p>
            </div>
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-zinc-700">
                Roll
              </label>
              <select id="role" name="role" defaultValue="OWNER" className={FIELD}>
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <StoreCheckboxes stores={stores} selected={[]} />

          {createState.error ? (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
              {createState.error}
            </p>
          ) : null}
          {createState.message ? (
            <p role="status" className="rounded-xl bg-brand-50 p-3 text-sm text-brand-700">
              {createState.message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={creating}
            className="h-12 w-full rounded-2xl bg-zinc-900 px-6 font-semibold text-white transition active:scale-[0.99] disabled:bg-zinc-200 disabled:text-zinc-400"
          >
            {creating ? "Skapar…" : "Skapa konto"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-tight">Konton ({users.length})</h2>
        <ul className="mt-3 space-y-3">
          {users.map((user) => (
            <li key={user.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{user.email}</p>
                  <p className="text-sm text-zinc-500">
                    {user.name ? `${user.name} · ` : ""}
                    {ROLE_LABELS[user.role]}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                  {user.role === "ADMIN" ? "alla butiker" : `${user.stores.length} butik(er)`}
                </span>
              </div>

              {user.role === "OWNER" ? (
                <form action={setStoreAccessAction} className="mt-3">
                  <input type="hidden" name="userId" value={user.id} />
                  <StoreCheckboxes
                    stores={stores}
                    selected={user.stores.map((store) => store.id)}
                    compact
                  />
                  <button
                    type="submit"
                    className="mt-2 h-10 rounded-xl border border-zinc-200 px-4 text-sm font-medium transition hover:bg-zinc-50"
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
                  className="h-10 flex-1 rounded-xl border border-zinc-200 px-3 text-sm outline-none transition focus:border-zinc-400"
                />
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="h-10 shrink-0 rounded-xl border border-zinc-200 px-4 text-sm font-medium transition hover:bg-zinc-50 disabled:opacity-50"
                >
                  Byt
                </button>
              </form>
            </li>
          ))}
        </ul>

        {passwordState.error ? (
          <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
            {passwordState.error}
          </p>
        ) : null}
        {passwordState.message ? (
          <p role="status" className="mt-3 rounded-xl bg-brand-50 p-3 text-sm text-brand-700">
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
        <legend className="text-sm font-medium text-zinc-700">
          Butiker <span className="text-zinc-400">(krävs för butiksägare)</span>
        </legend>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {stores.map((store) => (
          <label
            key={store.id}
            className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm"
          >
            <input
              type="checkbox"
              name="storeIds"
              value={store.id}
              defaultChecked={selected.includes(store.id)}
              className="h-4 w-4 rounded border-zinc-300"
            />
            {store.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
