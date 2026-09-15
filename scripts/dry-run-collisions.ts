import { readSupplierRows } from "./_names";
import { parseProductName } from "../src/lib/product-name-parser";

const rows = readSupplierRows(process.argv[2]);
const seen = new Map<string, string[]>();

for (const { name, category } of rows) {
  const p = parseProductName(name, category);
  const key = `${p.brand}|${p.flavor}|${p.strength}|${p.format}`.toLowerCase();
  if (!seen.has(key)) seen.set(key, []);
  seen.get(key)!.push(name);
}

const collisions = [...seen.entries()].filter(([, names]) => names.length > 1);
console.log(`distinct identities: ${seen.size} of ${rows.length} rows`);
console.log(`colliding identities: ${collisions.length}, covering ${collisions.reduce((s, [, n]) => s + n.length, 0)} rows\n`);
for (const [key, names] of collisions.slice(0, 12)) {
  console.log(`  ${key}`);
  names.forEach((n) => console.log(`      ${n}`));
}
