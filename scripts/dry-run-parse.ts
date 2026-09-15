import { readSupplierRows } from "./_names";
import { parseProductName } from "../src/lib/product-name-parser";

const file = process.argv[2];
const rows = readSupplierRows(file);
const names = rows.map((r) => r.name);

let review = 0;
const byBrand = new Map<string, number>();
const noStrength: string[] = [];
const unknownBrand: string[] = [];

for (const { name, category } of rows) {
  const parsed = parseProductName(name, category);
  byBrand.set(parsed.brand, (byBrand.get(parsed.brand) ?? 0) + 1);
  if (parsed.needsReview) review += 1;
  if (parsed.reviewNotes.some((n) => n.startsWith("No strength"))) noStrength.push(name);
  if (parsed.reviewNotes.some((n) => n.includes("brand dictionary"))) unknownBrand.push(name);
}

console.log(`rows: ${names.length}  needs_review: ${review}  distinct brands: ${byBrand.size}`);
console.log(`\nunknown brand (${unknownBrand.length}):`);
console.log(unknownBrand.slice(0, 15).join("\n") || "  none");
console.log(`\nno strength (${noStrength.length}) — first 15:`);
console.log(noStrength.slice(0, 15).join("\n") || "  none");
console.log("\nsample parses:");
for (const { name, category } of rows.filter((_, i) => i % 97 === 0).slice(0, 22)) {
  const p = parseProductName(name, category);
  console.log(`  ${name}\n    -> [${p.brand}] [${p.flavor}] [${p.strength}] [${p.format}]${p.needsReview ? " *REVIEW*" : ""}`);
}
