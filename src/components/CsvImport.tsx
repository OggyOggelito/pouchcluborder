"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ImportResponse = {
  created?: number;
  updated?: number;
  deactivated?: number;
  parsed?: number;
  mode?: string;
  errorCount?: number;
  errors?: { line: number; message: string }[];
  error?: string;
  headers?: string[];
};

export default function CsvImport() {
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [failed, setFailed] = useState(false);

  async function readFile(file: File) {
    setFileName(file.name);
    setCsv(await file.text());
    setResult(null);
    setFailed(false);
  }

  async function runImport() {
    setBusy(true);
    setResult(null);
    setFailed(false);

    try {
      const response = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ csv, mode }),
      });
      const payload = (await response.json()) as ImportResponse;
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

  const lineCount = csv.trim() ? csv.trim().split("\n").length - 1 : 0;

  return (
    <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold tracking-tight">Importera produktkatalog (CSV)</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Kolumner: <code className="font-mono">brand, flavor, strength, format, pricePerStock</code>.
        Komma eller semikolon som avgränsare. <code className="font-mono">format</code> gissas från
        namnet om kolumnen saknas.
      </p>

      <label className="mt-4 flex h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 text-center transition hover:border-zinc-400">
        <input
          type="file"
          accept=".csv,text/csv,text/plain"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void readFile(file);
          }}
        />
        <span className="font-medium">{fileName ?? "Välj CSV-fil"}</span>
        <span className="mt-1 text-sm text-zinc-500">
          {csv ? `${lineCount} rader inlästa` : "eller klistra in nedan"}
        </span>
      </label>

      <textarea
        value={csv}
        onChange={(event) => {
          setCsv(event.target.value);
          setFileName(null);
        }}
        rows={6}
        spellCheck={false}
        placeholder={"brand,flavor,strength,format,pricePerStock\nZyn,Cool Mint,6mg,Mini,449"}
        className="mt-4 w-full rounded-xl border border-zinc-200 p-3 font-mono text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />

      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-zinc-600">Läge</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
              mode === "merge" ? "border-brand-500 bg-brand-50" : "border-zinc-200"
            }`}
          >
            <input
              type="radio"
              name="mode"
              checked={mode === "merge"}
              onChange={() => setMode("merge")}
              className="mt-1"
            />
            <span>
              <span className="block font-medium">Lägg till / uppdatera</span>
              <span className="block text-sm text-zinc-500">
                Rör inte produkter som saknas i filen.
              </span>
            </span>
          </label>

          <label
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
              mode === "replace" ? "border-brand-500 bg-brand-50" : "border-zinc-200"
            }`}
          >
            <input
              type="radio"
              name="mode"
              checked={mode === "replace"}
              onChange={() => setMode("replace")}
              className="mt-1"
            />
            <span>
              <span className="block font-medium">Ersätt katalogen</span>
              <span className="block text-sm text-zinc-500">
                Produkter utanför filen döljs (men raderas aldrig).
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      <button
        type="button"
        onClick={runImport}
        disabled={busy || csv.trim() === ""}
        className="mt-4 h-12 w-full rounded-2xl bg-zinc-900 px-6 font-semibold text-white transition active:scale-[0.99] disabled:bg-zinc-200 disabled:text-zinc-400"
      >
        {busy ? "Importerar…" : "Importera"}
      </button>

      {result ? (
        <div
          role="status"
          className={`mt-4 rounded-xl p-4 text-sm ${
            failed ? "bg-red-50 text-red-800" : "bg-brand-50 text-brand-700"
          }`}
        >
          {result.error ? (
            <p className="font-medium">{result.error}</p>
          ) : (
            <p className="font-medium">
              {result.created} nya, {result.updated} uppdaterade
              {result.mode === "replace" ? `, ${result.deactivated} dolda` : ""}.
            </p>
          )}

          {result.errors && result.errors.length > 0 ? (
            <details className="mt-2">
              <summary className="cursor-pointer">
                {result.errorCount ?? result.errors.length} rad(er) hoppades över
              </summary>
              <ul className="mt-2 space-y-1 font-mono text-xs">
                {result.errors.map((rowError) => (
                  <li key={`${rowError.line}-${rowError.message}`}>
                    rad {rowError.line}: {rowError.message}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
