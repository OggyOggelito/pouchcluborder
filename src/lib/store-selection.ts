export const STORE_COOKIE = "pc_store_id";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * The cookie is the source of truth (server components read it on first paint);
 * localStorage is a mirror so the choice survives a cookie being cleared by an
 * aggressive mobile browser.
 */
export function rememberStore(storeId: string): void {
  document.cookie = `${STORE_COOKIE}=${encodeURIComponent(storeId)}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
  try {
    window.localStorage.setItem(STORE_COOKIE, storeId);
  } catch {
    // Private mode / storage disabled — the cookie alone is good enough.
  }
}

export function forgetStore(): void {
  document.cookie = `${STORE_COOKIE}=; path=/; max-age=0; samesite=lax`;
  try {
    window.localStorage.removeItem(STORE_COOKIE);
  } catch {
    // Ignore.
  }
}

export function readRememberedStore(): string | null {
  try {
    return window.localStorage.getItem(STORE_COOKIE);
  } catch {
    return null;
  }
}
