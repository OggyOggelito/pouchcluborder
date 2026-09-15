import * as XLSX from "xlsx";

export const CATEGORIES: Record<string, string> = {
  "vitt snus": "Nicotine pouch",
  "nikotinfritt snus": "Nicotine-free pouch",
  tobakssnus: "Tobacco snus",
  vapes: "Vape",
};

export function readSupplierRows(file: string): { name: string; category: string }[] {
  const wb = XLSX.readFile(file);
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["MASTERDOC"], {
    range: 1,
    defval: null,
  });
  return rows
    .filter(
      (r) =>
        String(r["Aktiv"]).trim() === "Ja" &&
        CATEGORIES[String(r["Artikeltyp"]).trim().toLowerCase()] !== undefined
    )
    .map((r) => ({
      name: String(r["Benämning"] ?? "").trim(),
      category: CATEGORIES[String(r["Artikeltyp"]).trim().toLowerCase()],
    }));
}
