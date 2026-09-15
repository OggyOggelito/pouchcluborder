import { cookies } from "next/headers";
import { getStoreById, listStores, type StoreSummary } from "@/lib/repositories/stores";
import { STORE_COOKIE } from "@/lib/store-selection";

/** The store remembered on this device, or null if one has not been picked yet. */
export async function getCurrentStore(): Promise<StoreSummary | null> {
  const jar = await cookies();
  const storeId = jar.get(STORE_COOKIE)?.value;
  if (!storeId) return null;
  return getStoreById(decodeURIComponent(storeId));
}

export { listStores };
