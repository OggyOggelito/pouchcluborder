import type { SalesLine, SalesProvider, SalesRange } from "@/lib/sales/types";

/**
 * Sharp — the till system the figures are meant to come from.
 *
 * A stub, on purpose. We have no specification: not the base URL, not the
 * authentication, not whether a row is a receipt line or a day's total, not
 * whether returns are included. Guessing an endpoint would produce code that
 * looks finished and is wrong in a way nobody notices until the numbers are
 * in front of a supplier.
 *
 * docs/sharp-api-intake.md is the list of questions that turns this into a
 * real class. Until they are answered it throws, and selecting it is a
 * deliberate act: SALES_PROVIDER=sharp.
 */
export class SharpSalesProvider implements SalesProvider {
  readonly name = "Sharp (ej konfigurerat)";
  readonly canPull = true;

  async pull(_range: SalesRange): Promise<SalesLine[]> {
    throw new Error(
      "Sharp-API:t är inte konfigurerat. Se docs/sharp-api-intake.md för vad som behövs."
    );
  }
}
