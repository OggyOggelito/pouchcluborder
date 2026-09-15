# Pouch Club — Restock Orders

A small web app for Pouch Club store staff: open it on the shop floor, tick what's
running low, submit, export to Excel. The whole flow is meant to take under a minute.

- **Next.js (App Router) + TypeScript + Tailwind CSS**
- **SQLite via Prisma** — file-based, behind a repository layer so it can move to Postgres/Supabase later
- **SheetJS (`xlsx`)** for the Excel export

The UI is in Swedish (staff-facing); the Excel columns are in English as specified.

---

## Getting started

```bash
npm install
npm run setup   # creates prisma/dev.db, applies the schema, seeds stores + catalog
npm run dev     # http://localhost:3000
```

`npm run setup` is `prisma db push` followed by the seed. Both are idempotent — running
the seed again updates existing rows instead of duplicating them.

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server on :3000 |
| `npm run build` / `npm start` | Production build / serve |
| `npm run setup` | Apply schema + seed (first-time setup) |
| `npm run seed` | Re-run the seed only |
| `npm run db:push` | Apply schema changes to the SQLite file |
| `npm run db:reset` | Drop everything and rebuild from schema + seed |
| `npm run parse:check <file.xlsx>` | Dry-run the name parser over a masterdoc |
| `npm run parse:collisions <file.xlsx>` | List articles that parse to the same variant |

---

## What's in the seed

**Stores:** Täby Centrum, Helsingborg, Linköping, Örebro, Västermalmsgallerian (Stockholm).

**Catalog:** 176 placeholder variants across the 22 brands (77, Après, BAOW, Cafero, Cuba,
Denssi, Fumi, Greatest, Helwit, Kelly White, Kuma, Loop, Loop Mini, Lundgrens, Pablo,
Siberia, Skruf, Velo, White Fox, XQS, Zixs, Zyn) — roughly 8 flavor/strength variants each,
with plausible SEK prices. **These are placeholders**: replace them with the real catalog
via the CSV import below.

---

## Importing the catalog

There are two importers. Both go through the same `importProducts()` replace-mode
path, so both deactivate rather than delete (past orders keep their line items).

### 1. Supplier masterdoc (.xlsx) — the normal route

Go to **`/admin`** → *Importera leverantörsfil* and hand it the supplier file exactly
as it arrives (`Sortiment_YYYYMMDD.xlsx`, sheet `MASTERDOC`). No pre-cleaning. It:

1. Reads headers from **row 2** (row 1 is a stray banner row).
2. Keeps only `Aktiv = Ja`.
3. Keeps only these `Artikeltyp` values, matched case-insensitively because the source
   is inconsistent (`Vitt Snus`, `VItt Snus`, `Vitt snus` all appear):

   | Artikeltyp | Category |
   | --- | --- |
   | `Vitt Snus` | Nicotine pouch |
   | `Nikotinfritt snus` | Nicotine-free pouch |
   | `Tobakssnus` | Tobacco snus |
   | `Vapes` | Vape |

   Everything else (cigarettes, cigars, loose tobacco, accessories) is dropped.
4. Maps `Art.nr.` → sku, `Fabr./Repr.` → manufacturerCode (a **distributor** code —
   LUNA, SMD, ECIGG — *not* a retail brand), `Leverantör` → supplier, `Innehåll DFP` →
   unitsPerStock, `Pris 1st  inkl. moms` (double space in the source) → unitPrice,
   `Pris 2st inkl. moms` → casePrice, `Inpris` → costPrice, `EAN-kod KFP`/`EAN-kod DFP`
   → EANs (as digit strings, never floats), `Lager min`/`Lager max` → stockMin/stockMax.
5. Parses `Benämning` into brand / flavor / strength / format (see below).
6. Runs the result through the existing replace-mode import.

Afterwards you get counts per category, the `needs_review` count, how many duplicates
were merged, and what was filtered out — check that before trusting the result.

> **Where pricePerStock comes from.** The masterdoc has no per-stock price, so it is
> derived: **`Inpris` × `Innehåll DFP`** (23 kr × 10 = 230 kr) — what the store actually
> pays for a stock. `Pris 1st inkl. moms` and `Pris 2st inkl. moms` are shelf prices the
> *customer* pays; they are still stored per product as `unitPrice` / `casePrice`, but
> order totals are not built from them. Change `PRICE_BASIS` in
> `src/lib/supplier-xlsx.ts` to switch basis — it is one constant, and every price
> column is stored either way.

### The name parser

The masterdoc has no brand column, so brand/flavor/strength/format are read off
`Benämning` (`src/lib/product-name-parser.ts`):

- **Brand** — longest-prefix match against the dictionary in `src/lib/brands.ts`, which
  is what keeps `Nordic Spirit` from becoming `Nordic` and `Siberia-80` from becoming
  `Siberia`. Canonical spelling wins over the source's (the file mixes `ZYN`/`Zyn`,
  `FUMi`/`FUMI`, `skruf`/`Skruf`). **Add new brands here** — an unknown brand still
  imports, but gets flagged. Only list an actual brand: a product *line* belongs in the
  flavor. Listing `Knox Karaktär` as a brand hid `Knox Portion` and `Knox White`, because
  every Knox article was filed under the line name.
- **Strength** — `10,4 mg` / `20mg` / `10mg/p`, then `#3`-style tiers, then ZYN's
  `S2`/`S4` codes, then word strengths (`Extra Strong`, `Hypèr Strong`, `Stark`).
- **Format** — Mini / Slim / Large / Normal, plus **Lös** and **Portion**, which are the
  real formats for tobacco snus.
- **Flavor** — what's left after stripping `(...)` notes, `/19,2 g` weights, and
  `Engångsvape`. `White`/`Vit` is deliberately **kept**: for tobacco snus it names a real
  variant, and `Ettan Portion` vs `Ettan Portion Vit` are different articles.

### `needs_review`

Set when the parser wasn't confident, with the reason in `reviewNotes` and the original
`Benämning` kept in `sourceName` so a bad parse can always be traced back. It is raised
for: an unknown brand, a **nicotine pouch or vape with no strength in the name**, an
empty flavor, two articles that parsed to the same variant (only one is kept), and the
two price gaps below.

A missing strength is *not* flagged for nicotine-free pouches (stored as `0mg`) or
tobacco snus (stored as `Regular`) — those genuinely have no strength to state.

**An explicit nicotine-free name beats `Artikeltyp`.** The masterdoc files some
nicotine-free articles under `Vitt Snus` — on the 2026-09-14 file that is
`XQS Virgin Peppermint Nikotinfri` and the four `Après ... - ZERO` rows. When the name
says `Nikotinfri`, `No Nico`, `Nicotine free` or `Zero`, the row is filed as
nicotine-free (and so gets `0mg` rather than a missing-strength flag). The override is
counted in the import summary and noted on the product, because it is us disagreeing
with the supplier's own data. `virgin` alone is deliberately *not* a marker — it names a
mocktail flavour as often as it means nicotine-free.

**A missing `Inpris` is flagged, never guessed.** The product is imported at **0 kr** and
stays orderable, with a note saying the cost is missing. Inventing a price would put a
wrong number on every order that includes it; dropping the row would stop staff ordering
something they actually stock.

**A missing `Innehåll DFP` is inferred from the brand's other articles.** 54 rows in the
2026-09-14 file state no pack size. Assuming a single can is badly wrong — XQS Virgin
Peppermint is 27 kr a can but **270 kr a stock** — so the pack size is taken from the
most common value among that brand's other rows (34 other XQS articles say 10), falling
back to the category and then the whole file. Every pack size in this catalogue resolves
to 10. The assumption is always written into `reviewNotes`; rows that had to fall back
past the brand (Vozol, La Morenita — no sibling states a pack size) are flagged as well,
since that is a weaker guess about money.

On the 2026-09-14 file that's **359 of 1088** products: mostly nicotine pouches whose
name has no mg value, plus 67 with no `Inpris`, 27 whose pack size had to be guessed
beyond the brand, and the 5 recategorised rows. The admin page shows the count; the flagged
rows import and are orderable, they just need a human pass.

To check parse quality on a new file before importing:

```bash
npm run parse:check "/path/to/Sortiment_YYYYMMDD.xlsx"
npm run parse:collisions "/path/to/Sortiment_YYYYMMDD.xlsx"
```

### 2. Simple CSV — for hand-maintained lists

`/admin` → *Importera produktkatalog (CSV)*. Columns:

| Column | Required | Notes |
| --- | --- | --- |
| `brand` | yes | e.g. `White Fox` |
| `flavor` | yes | e.g. `Peppered Mint` |
| `strength` | yes | `10`, `10 mg`, `10mg` — all normalise to `10mg` |
| `format` | no | `Mini` / `Slim` / `Normal` / `Large` |
| `pricePerStock` | yes | `459`, `459,00`, `459.00`, `459,00 kr` all work |

Forgiving about delimiters (comma/semicolon/tab, auto-detected), a UTF-8 BOM, quoted
fields, and Swedish header names (`märke`, `smak`, `styrka`, `storlek`, `pris`). Missing
`format` is inferred from the flavor text. Bad rows are skipped and reported by line
number; the rest still imports.

This path only ever touches brand/flavor/strength/format/price — supplier fields on an
existing product are left alone.

### Modes

- **Ersätt katalogen (replace)** — deactivates the whole catalog, then reactivates
  exactly what's in the file. The .xlsx importer always uses this.
- **Lägg till / uppdatera (merge)** — upserts the file's rows, leaves everything else
  alone. CSV only.

Products are **never hard-deleted**, only deactivated (`active = false`). Past orders
point at them, and an old order has to stay re-exportable.

---

## How it works

### Order flow

1. First visit asks which store you're in. The choice is stored in a cookie (read by the
   server on first paint) and mirrored to `localStorage`. "Byt butik" clears it.
2. Products are grouped **brand → flavor → strength/format variants**. Brands are collapsed
   by default so the list is scannable on a phone; searching expands matches automatically.
3. The search box matches brand, flavor, strength, and format. Every whitespace-separated
   token has to match, so `loop mango` and `white fox 30` both narrow the way you'd expect.
   Swedish vowels are folded (`skane` finds `Skåne`).
4. A brand that sells in more than one category (Lundgrens, Skruf, Loop, Velo, Lewa sell
   both pouches and something else) splits into labelled sections inside its brand row;
   brands in a single category show it as a chip. Category chips above the list filter
   the whole catalogue to Vitt snus / Nikotinfritt / Tobakssnus / Vape.
5. Quantities use −/number/+ controls with 44px tap targets. A zero renders blank and
   greyed, and a variant whose strength the masterdoc never stated says "styrka saknas"
   rather than rendering a blank.
6. The sticky footer shows running total stocks and SEK. Submit is disabled at zero.
7. An unsent order is kept in `localStorage` per store, so a reload or a phone locking
   doesn't lose it. It's cleared on successful submit.
8. After submit you get the Excel export button; the same file stays available from
   **`/orders`**.

### Excel export

`GET /api/orders/[id]/export` streams a one-sheet `.xlsx`:
`Brand, Flavor, Strength, Format, Quantity (stockar), Unit Price, Line Total`, plus a
`TOTAL` row. Price columns carry a SEK number format. Filename looks like
`pouchclub-taby-centrum-2026-09-15-adrpyp.xlsx`.

### Prices

`OrderLine` stores a `unitPrice` snapshot taken at submit time, and prices are read from the
database on the server — never trusted from the browser. Re-importing the catalog at new
prices doesn't rewrite the history of past orders.

---

## Project layout

```
prisma/
  schema.prisma          Store, Product, Order, OrderLine
  seed.ts                5 stores + placeholder catalog
src/
  app/
    page.tsx             Order flow (store picker or product list)
    orders/page.tsx      Recent orders for the current store
    admin/page.tsx       CSV import
    api/orders/          POST order, GET Excel export
    api/admin/import/    POST CSV import
  components/            OrderForm, QuantityInput, StorePicker, CsvImport
  lib/
    repositories/        The ONLY place that touches Prisma
    supplier-xlsx.ts     Raw masterdoc -> filtered, normalised rows
    product-name-parser.ts  Benämning -> brand/flavor/strength/format
    brands.ts            Brand dictionary (add new brands here)
    db.ts                Prisma client + SQLite driver adapter
    csv.ts               CSV parsing
    catalog.ts           Strength/format/price normalisation
    grouping.ts          Brand → flavor → variant grouping + search
    excel.ts             Workbook builder
```

`src/lib/repositories/*` is the swap point. Nothing in `app/` or `components/` imports Prisma
directly, so moving to Postgres/Supabase means changing `db.ts` (client + adapter), the
`provider` in `schema.prisma`, and nothing else.

`src/lib/grouping.ts` and `src/lib/catalog.ts` are pure functions with no I/O — the natural
place to start if you add tests.

### Database location

`DATABASE_URL` is project-root-relative (`file:./prisma/dev.db`). The Prisma CLI resolves
relative SQLite paths against the schema directory while the runtime driver resolves against
the working directory, so `src/lib/sqlite-url.ts` normalises both to one absolute path.
`prisma.config.ts` feeds the CLI from that same helper. `prisma/dev.db` is git-ignored.

---

## Not in Phase 1

### No authentication

Anyone who can reach the app can order for any store and open `/admin`. That's deliberate for
Phase 1. When you add auth (NextAuth / Clerk / Supabase Auth):

1. **Middleware** — add `src/middleware.ts` with a matcher over `/admin` and `/api/admin/:path*`
   first; the import endpoint is the one that can overwrite the whole catalog.
2. **Store identity** — replace the `pc_store_id` cookie in `src/lib/current-store.ts` with the
   store on the signed-in user's session. `getCurrentStore()` is the single place the rest of
   the app asks "which store is this?", so everything downstream keeps working.
3. **Order attribution** — add `userId` (or `submittedBy`) to `Order` and set it in
   `createOrder()` in `src/lib/repositories/orders.ts`.
4. **Export authorisation** — `GET /api/orders/[id]/export` currently serves any order id to
   anyone. Once sessions exist, check that the order's store matches the caller's store.

Also missing by design: no analytics or charts, no recommended-quantity logic, no Shopify/POS
integration.

---

## Phase 2 notes

The schema already supports it — `Order` has `storeId` + `submittedAt`, `OrderLine` has
`productId` + `quantity` + `unitPrice`, which is everything an `/analytics` page and a
suggested-quantity function need. No migration required.

Per-store `demandWeight` will be a new column on `Store`, and the suggestion should be one
pure function (order-history average × store weight) so real Sharp POS sales data can be
swapped in for the order-history average later.
