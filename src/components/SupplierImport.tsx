"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type SupplierResult = {
  created?: number;
  updated?: number;
  deactivated?: number;
  mode?: string;
  priceBasis?: string;
  fileName?: string;
  stats?: {
    totalRows: number;
    skippedInactive: number;
    skippedCategory: number;
    skippedUnusable: number;
    mergedDuplicates: number;
    byCategory: Record<string, number>;
    needsReview: number;
  };
  problems?: { name: string; message: string }[];
  problemCount?: number;
  error?: string;
};

export default function SupplierImport() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SupplierResult | null>(null);
  const [failed, setFailed] = useState(false);

  async function runImport() {
    if (!file) return;
    setBusy(true);
    setResult(null);
    setFailed(false);

    try {
      const body = new FormData();
      body.set("file", file);
      body.set("mode", "replace");

      const response = await fetch("/api/admin/import-supplier", { method: "POST", body });
      const payload = (await response.json()) as SupplierResult;
      setResult(payload);
      setFailed(!response.ok);
      if (response.ok) router.refresh();
    } catch {
      setResult({ error: "Kunde inte nå servern." });
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const stats = result?.stats;

  return (
    <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold tracking-tight">
        Importera leverantörsfil (rå .xlsx)
      </h2>
      <p className="mt-1 text-sm text-zinc-600">
        Ta masterdocen precis som den kommer (<code className="font-mono">Sortiment_ÅÅÅÅMMDD.xlsx</code>,
        blad <code className="font-mono">MASTERDOC</code>) — ingen förstädning behövs. Rubrikrad 2,
        bara <code className="font-mono">Aktiv = Ja</code>, och bara vitt snus, nikotinfritt,
        tobakssnus och vapes. Körs alltid i <strong>ersätt-läge</strong>.
      </p>

      <label className="mt-4 flex h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 text-center transition hover:border-zinc-400">
        <input
          type="file"
          accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(event) => {
            const picked = event.target.files?.[0] ?? null;
            setFile(picked);
            setResult(null);
            setFailed(false);
          }}
        />
        <span className="font-medium">{file?.name ?? "Välj Sortiment-fil (.xlsx)"}</span>
        <span className="mt-1 text-sm text-zinc-500">
          {file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : "MASTERDOC-bladet läses automatiskt"}
        </span>
      </label>

      <button
        type="button"
        onClick={runImport}
        disabled={busy || !file}
        className="mt-4 h-12 w-full rounded-2xl bg-zinc-900 px-6 font-semibold text-white transition active:scale-[0.99] disabled:bg-zinc-200 disabled:text-zinc-400"
      >
        {busy ? "Importerar…" : "Importera leverantörsfil"}
      </button>

      {result ? (
        <div
          role="status"
          className={`mt-4 rounded-xl p-4 text-sm ${
            failed ? "bg-red-50 text-red-800" : "bg-brand-50 text-brand-700"
          }`}
        >
          {result.error ? <p className="font-medium">{result.error}</p> : null}

          {stats ? (
            <div className="space-y-3">
              {!result.error ? (
                <p className="font-medium">
                  {result.created} nya, {result.updated} uppdaterade, {result.deactivated} dolda.
                </p>
              ) : null}

              <div>
                <p className="font-medium">Per kategori</p>
                <ul className="mt-1 tabular-nums">
                  {Object.entries(stats.byCategory).map(([category, count]) => (
                    <li key={category}>
                      {category}: {count}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="font-medium">Kontrollera</p>
                <ul className="mt-1 tabular-nums">
                  <li>
                    needs_review: <strong>{stats.needsReview}</strong> av{" "}
                    {Object.values(stats.byCategory).reduce((sum, n) => sum + n, 0)} produkter
                  </li>
                  <li>sammanslagna dubbletter: {stats.mergedDuplicates}</li>
                  <li>
                    bortfiltrerade: {stats.skippedInactive} inaktiva, {stats.skippedCategory} fel
                    kategori, {stats.skippedUnusable} utan pris/namn
                  </li>
                  <li className="text-zinc-500">
                    läste {stats.totalRows} rader ur MASTERDOC
                  </li>
                </ul>
              </div>

              {result.problems && result.problems.length > 0 ? (
                <details>
                  <summary className="cursor-pointer">
                    {result.problemCount} rad(er) hoppades över
                  </summary>
                  <ul className="mt-2 space-y-1 font-mono text-xs">
                    {result.problems.map((problem) => (
                      <li key={`${problem.name}-${problem.message}`}>
                        {problem.name}: {problem.message}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
