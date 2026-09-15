import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { resolveSqlitePath } from "../src/lib/sqlite-url";
import { normalizeStrength, type ProductFormat } from "../src/lib/catalog";
import { slugify } from "../src/lib/format";

const STORES = [
  { name: "Täby Centrum", city: "Täby" },
  { name: "Helsingborg", city: "Helsingborg" },
  { name: "Linköping", city: "Linköping" },
  { name: "Örebro", city: "Örebro" },
  { name: "Västermalmsgallerian", city: "Stockholm" },
];

type BrandSeed = {
  brand: string;
  format: ProductFormat;
  /** Price per stock (10 cans) in SEK. */
  price: number;
  strengths: string[];
  flavors: string[];
};

// Representative variants only — the real catalog is imported from CSV via /admin.
const BRANDS: BrandSeed[] = [
  { brand: "77", format: "Slim", price: 349, strengths: ["6mg", "12mg"], flavors: ["Cool Mint", "Spearmint", "Lime", "Berry"] },
  { brand: "Après", format: "Slim", price: 419, strengths: ["10mg", "16mg"], flavors: ["Cool Rush", "Blueberry", "Watermelon", "Mango"] },
  { brand: "BAOW", format: "Slim", price: 389, strengths: ["8mg", "14mg"], flavors: ["Cool Mint", "Citrus", "Berry", "Eucalyptus"] },
  { brand: "Cafero", format: "Slim", price: 399, strengths: ["10mg", "16mg"], flavors: ["Espresso", "Cappuccino", "Vanilla Latte", "Caramel"] },
  { brand: "Cuba", format: "Slim", price: 379, strengths: ["12mg", "20mg"], flavors: ["Ice Mint", "Black", "Watermelon", "Mango"] },
  { brand: "Denssi", format: "Slim", price: 359, strengths: ["9mg", "15mg"], flavors: ["Mint", "Berry", "Citrus", "Melon"] },
  { brand: "Fumi", format: "Slim", price: 369, strengths: ["10mg", "16mg"], flavors: ["Peach", "Mango", "Mint", "Cola"] },
  { brand: "Greatest", format: "Slim", price: 339, strengths: ["8mg", "14mg"], flavors: ["Mint", "Menthol", "Berry", "Watermelon"] },
  { brand: "Helwit", format: "Slim", price: 399, strengths: ["8mg", "14mg"], flavors: ["Mint", "Lakrits", "Hallon", "Blueberry"] },
  { brand: "Kelly White", format: "Slim", price: 389, strengths: ["10mg", "16mg"], flavors: ["Cool Mint", "Berry", "Citrus", "Mango"] },
  { brand: "Kuma", format: "Slim", price: 369, strengths: ["10mg", "17mg"], flavors: ["Arctic Mint", "Berry", "Tropical", "Coffee"] },
  { brand: "Loop", format: "Slim", price: 439, strengths: ["10mg", "16mg"], flavors: ["Jalapeño Lime", "Mango Chili", "Blueberry Mint", "Ice Cold"] },
  { brand: "Loop Mini", format: "Mini", price: 429, strengths: ["6mg", "10mg"], flavors: ["Ice Cold", "Blueberry Mint", "Mango Chili", "Jalapeño Lime"] },
  { brand: "Lundgrens", format: "Slim", price: 409, strengths: ["8mg", "14mg"], flavors: ["Skåne", "Jämtland", "Norrland", "Gotland"] },
  { brand: "Pablo", format: "Slim", price: 469, strengths: ["30mg", "50mg"], flavors: ["Ice Cold", "Exclusive", "Frosted Apple", "Watermelon"] },
  { brand: "Siberia", format: "Normal", price: 449, strengths: ["24mg", "43mg"], flavors: ["Blue", "Red", "White Mint", "Brown"] },
  { brand: "Skruf", format: "Slim", price: 419, strengths: ["8mg", "14mg"], flavors: ["Super White Fresh", "Super White Polar", "Nordic Mint", "Blackcurrant"] },
  { brand: "Velo", format: "Slim", price: 429, strengths: ["6mg", "10mg"], flavors: ["Ice Cool", "Freeze", "Ruby Berry", "Tropic Breeze"] },
  { brand: "White Fox", format: "Slim", price: 459, strengths: ["16mg", "30mg"], flavors: ["Original", "Full Charge", "Peppered Mint", "Double Mint"] },
  { brand: "XQS", format: "Slim", price: 349, strengths: ["8mg", "14mg"], flavors: ["Arctic Cool", "Watermelon", "Mango", "Cola"] },
  { brand: "Zixs", format: "Slim", price: 359, strengths: ["10mg", "16mg"], flavors: ["Ice Mint", "Berry", "Melon", "Citrus"] },
  { brand: "Zyn", format: "Mini", price: 449, strengths: ["6mg", "9mg"], flavors: ["Cool Mint", "Citrus", "Espressino", "Black Cherry"] },
];

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: resolveSqlitePath() }),
});

async function main() {
  for (const store of STORES) {
    const slug = slugify(store.name);
    await prisma.store.upsert({
      where: { slug },
      update: { name: store.name, city: store.city },
      create: { name: store.name, slug, city: store.city },
    });
  }

  let created = 0;
  let updated = 0;

  for (const seed of BRANDS) {
    for (const flavor of seed.flavors) {
      for (const rawStrength of seed.strengths) {
        const strength = normalizeStrength(rawStrength);
        const key = {
          brand_flavor_strength_format: {
            brand: seed.brand,
            flavor,
            strength,
            format: seed.format,
          },
        };

        const existing = await prisma.product.findUnique({ where: key, select: { id: true } });

        // Stronger variants cost a little more — enough spread to make the
        // running SEK total in the footer look realistic.
        const price = rawStrength === seed.strengths[0] ? seed.price : seed.price + 20;

        if (existing) {
          await prisma.product.update({ where: key, data: { pricePerStock: price, active: true } });
          updated += 1;
        } else {
          await prisma.product.create({
            data: {
              brand: seed.brand,
              flavor,
              strength,
              format: seed.format,
              pricePerStock: price,
              active: true,
            },
          });
          created += 1;
        }
      }
    }
  }

  const stores = await prisma.store.count();
  console.log(
    `Seed complete: ${stores} stores, ${created} products created, ${updated} products updated.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
