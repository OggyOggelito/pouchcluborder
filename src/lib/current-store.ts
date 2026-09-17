import { cookies } from "next/headers";
import type { StoreSummary } from "@/lib/repositories/stores";
import { listStores } from "@/lib/repositories/stores";
import type { UserRecord } from "@/lib/repositories/users";
import { storesForUser } from "@/lib/session";
import { STORE_COOKIE } from "@/lib/store-selection";

export type StoreResolution =
  /** Go straight to the order form for this store. */
  | { kind: "store"; store: StoreSummary; choices: StoreSummary[] }
  /** Several stores and none picked yet — show a picker limited to `choices`. */
  | { kind: "choose"; choices: StoreSummary[] }
  /** The account exists but has no store granted; an admin has to fix that. */
  | { kind: "none" };

/**
 * Which store this user is ordering for.
 *
 * With exactly one store the picker is skipped entirely — that is the common
 * case and it makes the flow one tap shorter than it was before login existed.
 * With several, the remembered cookie is honoured only if it names a store the
 * user still has access to, so a revoked store cannot linger on a device.
 */
export async function resolveOrderingStore(user: UserRecord): Promise<StoreResolution> {
  const choices = await storesForUser(user);

  if (choices.length === 0) return { kind: "none" };
  if (choices.length === 1) return { kind: "store", store: choices[0], choices };

  const jar = await cookies();
  const remembered = jar.get(STORE_COOKIE)?.value;
  const storeId = remembered ? decodeURIComponent(remembered) : null;
  const match = storeId ? choices.find((store) => store.id === storeId) : undefined;

  return match ? { kind: "store", store: match, choices } : { kind: "choose", choices };
}

export { listStores };
