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
cp .env.example .env          # then set AUTH_SECRET (openssl rand -base64 32)
npm run setup                 # schema + stores + catalog
npm run backfill:brands -- --publish   # a brand page per catalog brand
npm run seed:users            # one ADMIN + one OWNER per store
npm run dev                   # http://localhost:3000
```

`AUTH_SECRET` is required — Auth.js signs session cookies with it and login fails
without it.

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
| `npm run seed:users` | Create the ADMIN + one OWNER per store (idempotent) |
| `npm run backfill:brands` | Create/link a `Brand` row per catalog brand |
| `npm run backfill:brands -- --publish` | Same, and publish brands that have stock |
| `npm run fetch:snusbolaget` | Crawl snusbolaget.se specs into `data/snusbolaget-facts.json` |
| `npm run enrich:strengths` | Match those facts onto the catalog by EAN (dry run) |

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
past the brand are flagged as well, since that is a weaker guess about money.

When you have checked a brand's real stock price, add it to `CONFIRMED_PACK_SIZES` in
`src/lib/brands.ts`. That pack size is then used as given and the rows stop being
flagged, instead of being re-guessed on every import.

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

## Filling strength gaps from snusbolaget.se

The supplier masterdoc states no nicotine strength for most nicotine pouches —
on the 2026-09-14 file, only 308 of 1099 names carry an mg value. snusbolaget.se
publishes the manufacturer's figures as structured data, and both sides carry the
manufacturer's **EAN**, so the two catalogues can be joined exactly rather than by
fuzzy name matching.

```bash
npm run fetch:snusbolaget        # crawl the product sitemap -> data/snusbolaget-facts.json
npm run enrich:strengths         # dry run: what would be filled, and from where
npm run enrich:strengths -- --apply
```

### What is taken, and what is not

Taken — factual specifications: EAN/gtin13, article name, brand name, manufacturer,
format, product type, weight, portions per can, and the manufacturer's nicotine
content (mg per portion and mg per gram).

**Not** taken: the product and brand descriptions, which are snusbolaget's own
written copy, and "Snusbolagets styrka", which is their editorial rating rather than
a manufacturer fact. Nothing they wrote is copied into our brand pages — the staff
guide's content is written by us.

### What the 2026-09-19 run found

| | |
| --- | --- |
| Their products | 1 024 (0 fetch failures) |
| Our active products | 1 088 |
| Matched on EAN | 541 |
| — blank strengths filled | **133** |
| Ours they do not list | 547 (145 of those still have no strength) |
| Theirs we do not stock | 483 |

`npm run crosscheck` writes the full comparison to
`data/assortment-crosscheck.json`, including which of their brands we carry nothing
from — Swedsnus (30), Zeronito (25), Übbs Pouches (23), FIX (16) lead that list.

### Crawling politely

`robots.txt` (checked 2026-09-19) disallows only `/sok?` and advertises the product
sitemap, which is what the crawler reads. Requests go out one at a time with a 700 ms
delay and a User-Agent naming the bot and a contact address. Every page is cached
outside the repo, so a re-run costs them nothing and only fetches what is new.

> The live site is **snusbolaget.se**. `snusbolaget.com` is parked on DNS Made Easy
> and serves a certificate for another domain.

### Why the figures do not go into `strength`

`strength` is part of `@@unique([brand, flavor, strength, format])`, which is how the
importer finds an existing product. Writing a scraped mg value into it would mean the
next catalog import no longer matched that row: it would create a duplicate at the
blank strength and leave the enriched row deactivated.

So the figures live in their own columns — `nicotineMgPerPortion`, `nicotineMgPerGram`,
`portionsPerCan`, `nicotineSource`, `nicotineCheckedAt` — which no import path writes,
so they survive a re-import untouched. Where a product has no strength of its own, the
order page and the brand page show the matched figure prefixed with `~` and marked as
coming from snusbolaget.se, rather than presenting it as something the supplier stated.

---

## Accounts and access

Ordering requires a login. The staff knowledge guide (`/staff`) does not — that is
deliberate, so anyone on the shop floor can read it without an account.

| Route | Who |
| --- | --- |
| `/staff`, `/staff/brands/[slug]` | Anyone, no login |
| `/`, `/orders` | Any signed-in user |
| `/admin`, `/admin/brands`, `/admin/users` | `ADMIN` only |

### Roles

- **`OWNER`** — orders for the stores granted in `StoreAccess`, and only ever sees
  that store's order history and exports.
- **`ADMIN`** — every store, plus the admin area.

Roles are a plain string (`User.role`), not a Prisma enum, so a third role needs no
migration — add it to `ROLES` in `src/lib/roles.ts` and decide what
`canAccessAllStores` should say about it.

### Creating accounts

There is no self-signup. Either:

```bash
npm run seed:users     # ADMIN + one OWNER per store; keeps existing passwords
```

…or **`/admin/users`**, which creates an account, sets its role, ticks which stores it
may order for, and changes any password. An `OWNER` must have at least one store, or
they land on "Ingen butik kopplad".

Seeded logins are `admin@pouchclub.se` and `<store-slug>@pouchclub.se` (so
`linkoping@pouchclub.se`). The default passwords are placeholders — change them at
`/admin/users`, or set `SEED_ADMIN_PASSWORD` / `SEED_OWNER_PASSWORD` before seeding.
Re-running the seed never overwrites a password you have already changed.

### How the login is wired

- **Auth.js v5**, credentials provider, bcrypt (12 rounds), **JWT sessions** — Auth.js
  does not support database sessions with the credentials provider, so that choice is
  made for us.
- The JWT holds only the user id. Role and store access are read from the database on
  every request (`src/lib/session.ts`), so revoking a store takes effect immediately
  rather than when the token expires.
- `src/proxy.ts` (this Next version renamed `middleware.ts` to `proxy.ts`) only checks
  whether a session cookie *exists*, and redirects to `/login` if not. It is an
  optimistic redirect, not the authorization — the Next docs are explicit about not
  using proxy for that. Every protected page and API route calls `requireUser`,
  `requireAdmin` or `canOrderForStore` itself.
- A wrong password and an unknown email take about the same time to answer, because
  `authorize()` runs a bcrypt compare either way.

### One store = no picker

An owner with exactly one store goes straight into that store's order page, and the
"Byt butik" link is hidden — one tap fewer than before logins existed. With more than
one store they get a picker limited to their own stores, and a remembered store is
only honoured if they still have access to it.

---

## Staff knowledge guide

`/staff` lists every **published** brand, grouped by category and searchable. A brand
that sells in more than one category (Lundgrens, Skruf, Loop, Velo, Lewa) is listed
under each, with that category's own product count, so it is findable either way.

`/staff/brands/[slug]` is one brand: description, manufacturing process, blending
notes, logo/hero image, and the brand's active flavours pulled live from the catalog.

### Where the first three pages came from

Skruf, Velo and XQS have content written by hand (`npm run seed:brand-content`).
The text is ours, written from factual sources — Skruf's own account of its
production in Sävsjö, manufacturer figures, and the strength spread in our catalog.
No marketing copy from a brand's or a competitor's site is reproduced, and that is
the line to keep when adding the rest: take the facts, write the words.

Re-running that script overwrites those three brands, so once you have edited a page
at `/admin/brands/[id]`, edit it there rather than in the script.

### Editing brand content

`/admin/brands` lists every brand with its draft/published state; `/admin/brands/[id]`
edits one. The long-form fields are plain **markdown textareas** — `##` headings, `-`
lists, `**bold**`, `>` quotes and links all render. There is no WYSIWYG and no CMS.

A brand with nothing written yet still has a working page; it shows "Innehåll kommer
snart" above its stock list rather than a blank or broken page. Untick **Publicerad**
to hide a brand from `/staff` while writing — its URL then returns 404.

### Where brands come from

`Brand` is a real table, and `Product.brandId` points at it. The brand-parsing logic
is **not** re-run on read: `npm run backfill:brands` creates a row per distinct parsed
brand and links the products once, and every catalog import calls the same
`syncBrandsFromProducts()` so a newly imported brand gets a draft page automatically.
Editorial content is never touched by an import.

`Brand.slug` uses `brandSlug()` rather than the older `slugify()`, which drops accents
entirely and would turn "Göteborgs Rapé" into `goteborgs-rap`. All 71 current brands
produce unique slugs; the sync appends `-2` if a future one ever collides.

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
  auth.ts                Auth.js config (credentials provider, JWT)
  proxy.ts               Optimistic redirect for signed-out users
  lib/
    session.ts           requireUser / requireAdmin / store access checks
    roles.ts             OWNER | ADMIN
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

### Manual password resets

There is no self-service reset. An admin sets a new password from `/admin/users`,
or you re-run `npm run seed:users` with `SEED_OWNER_PASSWORD` for a fresh install.

To add a real reset flow later: add a `PasswordResetToken` model (userId, hashed
token, expiresAt, usedAt), a `POST /api/auth/reset-request` route that emails a
signed link, and a `/reset/[token]` page that calls the same bcrypt hashing used by
`setPasswordAction` in `src/lib/admin-actions.ts`. Nothing else needs to change —
passwords already live only as bcrypt hashes on `User.hashedPassword`.

### Still not built

No analytics or charts, no recommended-quantity logic, no Shopify/POS integration,
and no self-signup (accounts are created by an admin, by design).

## Phase 2 notes

The schema already supports it — `Order` has `storeId` + `submittedAt`, `OrderLine` has
`productId` + `quantity` + `unitPrice`, which is everything an `/analytics` page and a
suggested-quantity function need. No migration required.

Per-store `demandWeight` will be a new column on `Store`, and the suggestion should be one
pure function (order-history average × store weight) so real Sharp POS sales data can be
swapped in for the order-history average later.
