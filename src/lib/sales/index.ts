import { ManualSalesProvider } from "@/lib/sales/manual-provider";
import { SharpSalesProvider } from "@/lib/sales/sharp-provider";
import type { SalesProvider } from "@/lib/sales/types";

export type { SalesLine, SalesProvider, SalesRange } from "@/lib/sales/types";

/**
 * The single switch, the same shape as `SCHEDULE_PROVIDER`.
 *
 * | value              | reads                                  |
 * | ------------------ | -------------------------------------- |
 * | `manual` (default) | files an ADMIN uploads                 |
 * | `sharp`            | the till system — not configured yet    |
 */
export function getSalesProvider(): SalesProvider {
  const configured = (process.env.SALES_PROVIDER ?? "manual").toLowerCase();

  switch (configured) {
    case "sharp":
      return new SharpSalesProvider();
    case "manual":
      return new ManualSalesProvider();
    default:
      // An unknown value must not silently fall back to a different source
      // than the one asked for.
      throw new Error(`Unknown SALES_PROVIDER "${configured}". Use "manual" or "sharp".`);
  }
}

/**
 * Statistics are off until somebody switches them on.
 *
 * With the flag off there is no menu item, no route and no supplier page —
 * the figures are commercially sensitive and half-built statistics in front
 * of a supplier is worse than none.
 */
export function salesStatsEnabled(): boolean {
  const value = process.env.SALES_STATS_ENABLED;
  return value === "1" || value?.toLowerCase() === "true";
}
