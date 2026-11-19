/**
 * The shape the import form carries between submissions.
 *
 * In its own module because src/lib/sales-actions.ts is a `"use server"`
 * file, and such a file may only export async functions — exporting the empty
 * state from there makes the whole module fail to load, which shows up as a
 * 500 on the page that imports it rather than as a type error.
 */
export type ImportState = {
  error: string | null;
  summary: {
    rowsRead: number;
    rowsStored: number;
    rowsUnmatched: number;
    unknownStores: string[];
    from: string;
    to: string;
  } | null;
  /** Parse errors, at most a handful shown. */
  problems: string[];
};

export const EMPTY_IMPORT: ImportState = { error: null, summary: null, problems: [] };
