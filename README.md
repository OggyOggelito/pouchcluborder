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

---

## What's in the seed

**Stores:** Täby Centrum, Helsingborg, Linköping, Örebro, Västermalmsgallerian (Stockholm).

**Catalog:** 176 placeholder variants across the 22 brands (77, Après, BAOW, Cafero, Cuba,
Denssi, Fumi, Greatest, Helwit, Kelly White, Kuma, Loop, Loop Mini, Lundgrens, Pablo,
Siberia, Skruf, Velo, White Fox, XQS, Zixs, Zyn) — roughly 8 flavor/strength variants each,
with plausible SEK prices. **These are placeholders**: replace them with the real catalog
via the CSV import below.

---

## Importing the real catalog (CSV)

Go to **`/admin`**, pick a file or paste the CSV, choose a mode, and import.

### Columns

| Column | Required | Notes |
| --- | --- | --- |
| `brand` | yes | e.g. `White Fox` |
| `flavor` | yes | e.g. `Peppered Mint` |
| `strength` | yes | `10`, `10 mg`, `10mg` — all normalise to `10mg` |
| `format` | no | `Mini` / `Slim` / `Normal` / `Large` |
| `pricePerStock` | yes | `459`, `459,00`, `459.00`, `459,00 kr` all work |

The importer is deliberately forgiving about how Shopify exports things:

- Comma, semicolon, or tab delimiters (auto-detected), UTF-8 BOM, quoted fields with commas inside.
- Swedish header names also work: `märke`, `smak`, `styrka`, `storlek`, `pris`.
- If `format` is missing, it is inferred from the flavor text (`Ice Cold Large` → `Large`,
  `Mint Slim` → `Slim`), falling back to `Normal`.
- Rows that are missing a brand, flavor, strength, or have an unparseable price are skipped
  and reported back with their line number — the rest of the file still imports.

### Modes

- **Lägg till / uppdatera (merge)** — upserts the rows in the file, leaves everything else alone.
- **Ersätt katalogen (replace)** — deactivates the whole catalog first, then reactivates
  exactly what's in the file. Use this for the first real import so the seed placeholders
  disappear.

Products are **never hard-deleted**, only deactivated (`active = false`). Past orders point at
them, and an old order has to stay re-exportable.

> A product's identity is `brand + flavor + strength + format`. If your export has no `format`
> column, the inferred value has to match what's already stored, or you'll get a second row
> instead of an update. For the first real import, use **replace** mode and the placeholders
> get switched off regardless.

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
4. Quantities use −/number/+ controls with 44px tap targets. A zero renders blank and greyed.
5. The sticky footer shows running total stocks and SEK. Submit is disabled at zero.
6. An unsent order is kept in `localStorage` per store, so a reload or a phone locking
   doesn't lose it. It's cleared on successful submit.
7. After submit you get the Excel export button; the same file stays available from
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
