import type { SalesLine, SalesProvider, SalesRange } from "@/lib/sales/types";

/**
 * The working path until the Sharp API exists: an ADMIN uploads a file.
 *
 * It cannot be pulled from, and says so rather than returning nothing. The
 * parsing lives in src/lib/sales/csv.ts and produces the same `SalesLine[]`
 * the real provider will, so everything downstream of the seam is already
 * being exercised by real imports.
 */
export class ManualSalesProvider implements SalesProvider {
  readonly name = "Manuell import (CSV)";
  readonly canPull = false;

  async pull(_range: SalesRange): Promise<SalesLine[]> {
    throw new Error(
      "Den manuella källan hämtar ingenting automatiskt — ladda upp en fil under Statistik."
    );
  }
}
