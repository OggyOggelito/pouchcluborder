"use client";

import { useActionState } from "react";
import { importSalesAction } from "@/lib/sales-actions";
import { EMPTY_IMPORT, type ImportState } from "@/lib/sales-import-state";

/**
 * Uploading a sales file.
 *
 * Reports what it did in rows, not in "klart": how many were read, how many
 * stored, how many could not be matched and which shops it did not recognise.
 * An import that quietly lost a day is the failure nobody notices until a
 * supplier asks why a Tuesday is missing.
 */
export default function SalesImportForm() {
  const [state, formAction, pending] = useActionState<ImportState, FormData>(
    importSalesAction,
    EMPTY_IMPORT
  );

  return (
    <form action={formAction} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <h2 className="font-semibold tracking-tight">Läs in försäljning</h2>
      <p className="mt-1 text-sm text-muted">
        CSV med kolumnerna datum, butik, antal och artikelnummer eller EAN. Belopp är frivilligt.
        En dag som läses in igen <strong>ersätter</strong> den dagen — samma fil två gånger ger
        inte dubbla siffror.
      </p>

      <input
        type="file"
        name="file"
        accept=".csv,text/csv,text/plain"
        required
        className="mt-3 block w-full text-sm file:mr-3 file:min-h-tap file:rounded-2xl file:border file:border-control file:bg-raised file:px-4 file:text-sm file:font-medium file:text-ink"
      />

      {state.error ? (
        <p role="alert" className="mt-3 rounded-xl border border-danger bg-raised p-3 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      {state.summary ? (
        <div role="status" className="mt-3 rounded-xl border border-success bg-raised p-3 text-sm">
          <p className="font-medium text-success">
            <span aria-hidden="true">✓ </span>
            {state.summary.rowsStored} rader inlästa för {state.summary.from} – {state.summary.to}.
          </p>
          <p className="mt-1 text-muted">
            {state.summary.rowsRead} rader lästes, {state.summary.rowsUnmatched} kunde inte
            matchas mot en produkt och ligger i granskningslistan.
          </p>
          {state.summary.unknownStores.length > 0 ? (
            <p className="mt-1 text-warning">
              <span className="sr-only">Varning:</span>
              <span aria-hidden="true">⚠ </span>Okända butiker:{" "}
              {state.summary.unknownStores.join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}

      {state.problems.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs text-warning">
          {state.problems.map((problem) => (
            <li key={problem}>
              <span className="sr-only">Varning:</span>
              <span aria-hidden="true">⚠ </span>
              {problem}
            </li>
          ))}
        </ul>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 min-h-tap w-full rounded-2xl bg-primary px-4 font-semibold text-on-primary transition active:scale-[0.99] disabled:opacity-50"
      >
        {pending ? "Läser in…" : "Läs in filen"}
      </button>
    </form>
  );
}
