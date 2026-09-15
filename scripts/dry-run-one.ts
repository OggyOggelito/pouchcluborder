import { readSupplierRows } from "./_names";
import { parseProductName } from "../src/lib/product-name-parser";

const [file, needle] = process.argv.slice(2);
for (const { name, category } of readSupplierRows(file)) {
  if (!name.toLowerCase().includes(needle.toLowerCase())) continue;
  const p = parseProductName(name, category);
  console.log(`  [${p.brand}] [${p.flavor}] [${p.strength}] [${p.format}]  <- ${name}`);
}
