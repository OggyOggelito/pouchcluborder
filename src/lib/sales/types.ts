/**
 * The only shape the sales code knows about.
 *
 * Same idea as `ScheduleProvider`: every page reads through one interface, so
 * swapping the CSV import for the Sharp API later is a new class and a config
 * value, not a change anywhere that renders a figure.
 *
 * A line is a day's total for one product in one shop. There is no receipt, no
 * till, no time of day and no cashier in this type, and nothing downstream can
 * ask for one — the grain is set here.
 */
export type SalesLine = {
  /** Our store id, when the source already speaks our ids. */
  storeId?: string | null;
  /** Whatever the file called the shop, for matching and for the error list. */
  storeName?: string | null;
  /** Local date, "2026-11-04". */
  date: string;
  sku?: string | null;
  ean?: string | null;
  /** The product name as the source wrote it. Kept only to resolve a mismatch. */
  description?: string | null;
  quantity: number;
  /** Gross sales in SEK, if the source reports money at all. */
  grossAmount?: number | null;
};

export type SalesRange = { from: string; to: string };

export interface SalesProvider {
  /** Shown in the admin panel so it is obvious which one is live. */
  readonly name: string;
  /**
   * Whether this provider can be asked for a range.
   *
   * The manual import cannot: it is pushed, not pulled. Saying so in the type
   * is better than a `pull` that quietly returns an empty list and leaves an
   * admin wondering where the figures went.
   */
  readonly canPull: boolean;
  pull(range: SalesRange): Promise<SalesLine[]>;
}
