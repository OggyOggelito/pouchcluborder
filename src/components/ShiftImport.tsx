"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Result = {
  created?: number;
  replaced?: number;
  skipped?: number;
  parsed?: number;
  source?: string;
  from?: string | null;
  to?: string | null;
  unknownEmails?: string[];
  unknownStores?: string[];
  errors?: { line: number; message: string }[];
  errorCount?: number;
  error?: string;
};

export default function ShiftImport() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [failed, setFailed] = useState(false);

  async function upload() {
    if (!file) return;
    setBusy(true);
    setResult(null);
    setFailed(false);

    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/admin/import-shifts", { method: "POST", body });
      const payload = (await response.json()) as Result;
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

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold tracking-tight">Importera schema</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Ladda upp en export från TooEasy (eller något annat schemaverktyg). Både{" "}
        <strong>CSV</strong> och <strong>.ics</strong> fungerar — formatet läses av innehållet,
        inte filändelsen.
      </p>
      <p className="mt-2 text-sm text-zinc-500">
        CSV-kolumner: <code className="font-mono">email, date, start, end, store</code>. Samma
        period kan laddas upp om — befintliga pass i filens datumintervall ersätts.
      </p>

      <label className="mt-4 flex h-24 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 text-center transition hover:border-zinc-400">
        <input
          type="file"
          accept=".csv,.ics,.txt,text/calendar,text/csv"
          className="hidden"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setResult(null);
            setFailed(false);
          }}
        />
        <span className="font-medium">{file?.name ?? "Välj schemafil"}</span>
        <span className="mt-1 text-sm text-zinc-500">CSV eller ICS</span>
      </label>

      <button
        type="button"
        onClick={upload}
        disabled={busy || !file}
        className="mt-4 h-12 w-full rounded-2xl bg-zinc-900 px-6 font-semibold text-white transition active:scale-[0.99] disabled:bg-zinc-200 disabled:text-zinc-400"
      >
        {busy ? "Importerar…" : "Importera schema"}
      </button>

      {result ? (
        <div
          role="status"
          className={`mt-4 space-y-3 rounded-xl p-4 text-sm ${
            failed ? "bg-red-50 text-red-800" : "bg-brand-50 text-brand-700"
          }`}
        >
          {result.error ? <p className="font-medium">{result.error}</p> : null}

          {result.created !== undefined ? (
            <p className="font-medium">
              {result.created} pass importerade
              {result.replaced ? `, ${result.replaced} ersatta` : ""} ({result.source}).
              {result.from ? ` Period ${result.from} – ${result.to}.` : ""}
            </p>
          ) : null}

          {result.skipped ? <p>{result.skipped} rad(er) hoppades över.</p> : null}

          {result.unknownEmails && result.unknownEmails.length > 0 ? (
            <p>
              <span className="font-medium">Okänd e-post:</span>{" "}
              {result.unknownEmails.join(", ")} — skapa konton på{" "}
              <code className="font-mono">/admin/users</code> först.
            </p>
          ) : null}

          {result.unknownStores && result.unknownStores.length > 0 ? (
            <p>
              <span className="font-medium">Okänd butik:</span> {result.unknownStores.join(", ")}
            </p>
          ) : null}

          {result.errors && result.errors.length > 0 ? (
            <details>
              <summary className="cursor-pointer">{result.errorCount} rad(er) med fel</summary>
              <ul className="mt-2 space-y-1 font-mono text-xs">
                {result.errors.map((problem) => (
                  <li key={`${problem.line}-${problem.message}`}>
                    rad {problem.line}: {problem.message}
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
