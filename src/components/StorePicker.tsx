"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { StoreSummary } from "@/lib/repositories/stores";
import { readRememberedStore, rememberStore } from "@/lib/store-selection";

export default function StorePicker({ stores }: { stores: StoreSummary[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  // If the cookie was dropped but localStorage still knows the store, restore it
  // silently instead of asking the user again.
  useEffect(() => {
    const remembered = readRememberedStore();
    if (remembered && stores.some((store) => store.id === remembered)) {
      rememberStore(remembered);
      router.refresh();
    }
  }, [router, stores]);

  function choose(storeId: string) {
    setBusy(storeId);
    rememberStore(storeId);
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Vilken butik är du i?</h1>
      <p className="mt-2 text-zinc-600">
        Vi kommer ihåg valet på den här enheten — du behöver bara göra det en gång.
      </p>

      <ul className="mt-6 space-y-3">
        {stores.map((store) => (
          <li key={store.id}>
            <button
              type="button"
              onClick={() => choose(store.id)}
              disabled={busy !== null}
              className="flex w-full items-center justify-between rounded-2xl border border-zinc-200 bg-white px-5 py-5 text-left shadow-sm transition active:scale-[0.99] hover:border-zinc-300 disabled:opacity-60"
            >
              <span>
                <span className="block text-lg font-medium">{store.name}</span>
                {store.city && store.city !== store.name ? (
                  <span className="block text-sm text-zinc-500">{store.city}</span>
                ) : null}
              </span>
              <span aria-hidden className="text-zinc-400">
                {busy === store.id ? "…" : "→"}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {stores.length === 0 ? (
        <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          Inga butiker i databasen. Kör <code className="font-mono">npm run setup</code> för att
          lägga in butiker och produkter.
        </p>
      ) : null}
    </main>
  );
}
