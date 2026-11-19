import { supplierHandlers } from "@/supplier-auth";

/**
 * The supplier portal's own auth endpoints.
 *
 * Under `/supplier` rather than `/api` so the session cookie, which is pinned
 * to that path, actually reaches them. Route handlers ignore layouts, so this
 * is not affected by the guard in src/app/supplier/layout.tsx — and it must
 * not be, or signing in would need to be signed in already.
 */
export const { GET, POST } = supplierHandlers;
