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
| `npm run seed:schedule` | Give stores a region and users a placeholder phone |
| `npm run seed:hours` | Seed the stores' opening hours (see Teamschema) |
| `npm run seed:shopfloor` | EXEMPEL checklist templates and a placeholder quiz |
| `npm run seed:routines` | One EXEMPEL routine article explaining how to write them |
| `npm run flavors:retag` | Derive flavour groups (skips hand-edited rows) |
| `npm test` | Run the test suite |
| `npm run ux:shots -- before\|after` | Screenshots of the main screens at 390x844 |
| `npm run ux:axe` | axe-core accessibility scan; `-- --json` for selectors |
| `npm run ux:targets` | Tap targets under 44px and sideways scroll |
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

## Teamschema

> The delivery report — which stores matched the seeded hours, which have no nearby
> store, what I assumed and what raises a privacy question — is in
> [`docs/teamschema.md`](docs/teamschema.md).

**The stores write their own schedule.** TooEasy WFM never granted API access, so the
plan changed: each owner enters their employees' shifts in the portal, and because
every shop is in the same system, nearby stores can see who is free and ask to borrow
them.

| Page | Who | What |
| --- | --- | --- |
| `/schedule` | everyone | Your own shifts, and your store's week read-only |
| `/store/schedule` | OWNER, ADMIN | The week grid — where the schedule is entered |
| `/store/schedule/copy` | OWNER, ADMIN | Preview before copying a week or a day |
| `/schedule/available` | OWNER, ADMIN | Who is free at nearby stores |
| `/schedule/extra` | OWNER, ADMIN | Extra-shift requests, in and out |
| `/store/employees` | OWNER, ADMIN | The staff list |
| `/admin/stores/[id]/hours` | ADMIN, OWNER for own store | Opening hours and red days |
| `/admin/nearby` | ADMIN | Which stores may see each other's free staff |

`/my-schedule` and `/team-schedule` are **308 redirects** to the first two.

### Local time, never instants

Dates are `"2026-11-04"` and times are `"10:00"`, stored as text. A shift is a
wall-clock fact about a shop: the 10:00 opening is 10:00 on both sides of the clock
change, and storing an instant is what makes it move. `src/lib/schedule/time.ts` is
the only place that knows how to read them, and `tests/schedule-rules.test.ts` walks
both 2026 and 2027 DST dates to prove nothing shifts.

### Opening hours drive the grid

`StoreOpeningHours` holds a row per weekday; `StoreOpeningException` holds the days
that do not follow it. **Swedish public holidays are deliberately not built in** —
five shops in four towns do not have one closing rule, and a wrong built-in calendar
would be trusted. ADMIN and OWNER enter their own.

Everything the grid says about a day is computed from those two: the one-tap templates
(`Hel dag` is open to close; `Öppning` and `Stängning` split the day at the half hour
and take the buffer), the coverage line (`Öppet 10–20, lucka 15–17`) and the warnings.

`SCHEDULE_SHIFT_BUFFER_MINUTES` (default 30, clamped 0–120) is how far outside opening
hours a shift may run before the grid warns. Somebody has to unlock, count the till and
cash up, so clock-hours are never shift hours.

Seed the hours the chain gave us:

```bash
npm run seed:hours                                        # idempotent
npm run seed:hours -- --force                             # overwrite edits
npm run seed:hours -- --alias "Kungsholmen=Västermalmsgallerian"
```

Stores are matched **by name**. A name with no store is reported and skipped — nothing
is invented. Today `Kungsholmen` matches nothing; the database calls that shop
`Västermalmsgallerian`.

### Warnings warn, they never block

A shift outside opening hours, two shifts that overlap for one person, a shift on a
closed day, a day with nobody in it, a gap in the coverage: all of them say so and
save anyway. A grid that refuses to record what the shop is actually doing gets worked
around in a chat group, and then the portal is wrong. The only refusals are a date
that is not a date, a time that is not a time, an end before its start, and a note
over 120 characters.

Warnings are text **and** an icon, never colour alone.

### Copying

"Kopiera förra veckan" previews first and writes from a plan recomputed on the server.
Nothing is overwritten: a destination that already holds that person at that start time
keeps what it has. Somebody who has left is not resurrected, and a **borrowed** shift is
never copied — an extra pass is another store's employee, agreed once, for one day.

### Cross-store availability

`/schedule/available` shows a name, a home store and the word "ledig". Not their hours,
not where they are working instead, not a phone number. Three gates, all server-side:

1. The employee's own `openToExtraShifts` consent, off by default.
2. The employee's home store must be **nearby** — explicit pairs set by an ADMIN at
   `/admin/nearby`, or, while no pairs exist at all, the same `region`. As soon as one
   pair is entered, region stops applying everywhere; falling back per store would mean
   unlinking a pair silently re-opened a whole region.
3. No shift that day, or none overlapping the asked-for times.

An ADMIN is not limited by the nearby setting. Consent still applies to them: an admin
who needs the full picture opens the store's grid, which is a different question from
"who may we ask".

### Extra shifts

The asking store sends a request; the employee's **own** store accepts or declines,
because they are that store's staff. Accepting creates the shift at the asking store
inside one transaction, marked `Extrapass`. Two races are closed there: a conditional
update on the status means two simultaneous answers cannot both land, and the
employee's shifts for that date are re-read inside the transaction, so somebody who
picked up work in the meantime cannot be double booked. Nothing throws inside the
transaction — a refusal is a returned value.

In-app notifications go out on request, accept, decline and withdrawal. There is still
no mail transport and no push keys in this app.

### Privacy

An employee row is a name, a home store, an active flag, a consent flag and an optional
account link. There is no field for a personnummer, payroll, a phone number, an email,
an absence reason or a note about the person, and the forms have no box to type them
into. A day off is the absence of a shift, not a record — once the app can store
"ledig" it is one step from storing why, and a reason for an absence is health
information.

The per-week change trail keeps who and when as a short summary string, pruned after
90 days on write.

### The provider seam

Nothing in the UI knows where shifts come from. Every page goes through one interface:

```ts
interface ScheduleProvider {
  getShifts(userIds: string[], range: DateRange): Promise<ShiftEntry[]>;
}
```

`ShiftEntry` is `{ userId, storeId, date, startTime, endTime }`. Times are **local
wall-clock strings**, never instants — converting to UTC and back is how an import
quietly moves a shift by an hour.

Which implementation is live is one value, `SCHEDULE_PROVIDER` in `.env`:

| Value | Implementation | State |
| --- | --- | --- |
| `manual` (default) | `StoreEnteredScheduleProvider` | **Working.** The schedule the stores type in. |
| `import` | `ManualImportScheduleProvider` | **Working but unused.** The CSV/ICS upload at `/admin/schedule`. |
| `tooeasy` | `TooEasyApiScheduleProvider` | **Implemented**, dormant. Throws if selected without credentials. |

An unrecognised value throws rather than falling back, so a typo cannot silently
serve data from a different source than the one asked for.

`manual` used to mean the CSV upload; it now means the portal's own Teamschema, which
is what "manual" means to anybody using the app. **Nothing was deleted.** The uploader,
the TooEasy client, mapper, provider and probe are all still there — the TooEasy admin
pages simply hide from navigation while the integration is off (`features.tooeasy`),
and the uploader only appears when `import` is the live source, because importing into
a table nothing reads is a trap.

### Switching back to TooEasy later

1. Put the credentials in `.env.local` and set `SCHEDULE_PROVIDER=tooeasy`.
2. Map employees at `/admin/tooeasy`, which reappears in the admin hub on its own.
3. `/schedule` and the Idag card read TooEasy from that moment.

The week grid at `/store/schedule` always reads the portal's own table — it is the
manual system's own UI — so it shows a warning while another provider is live, saying
that what you type there will not appear under Mitt schema.

### Importing shifts the old way (`SCHEDULE_PROVIDER=import`)

`/admin/schedule` (ADMIN only) takes a **CSV** or **`.ics`** export from TooEasy or
anywhere else. The format is detected from the file's contents, not its extension,
because exports are routinely saved with the wrong one.

CSV columns — Swedish header names work too (`e-post`, `datum`, `starttid`, `sluttid`,
`butik`):

| Column | Example |
| --- | --- |
| `email` | `linkoping@pouchclub.se` |
| `date` | `2026-09-25`, `25/09/2026` or `20260925` |
| `start` | `07:30`, `7.30` or `0730` |
| `end` | `16:00` |
| `store` | store name or slug, case-insensitive |

The `.ics` reader handles folded lines, `TZID` parameters and `ATTENDEE:mailto:`, and
falls back to finding an address in the description. It is deliberately not a full
RFC 5545 implementation — no recurrence, no timezone database — since scheduling
exports are flat lists of dated events.

**Re-uploading the same period replaces it.** Every shift for the people in the file,
inside the file's own date range, is cleared before the new rows land — so uploading a
corrected roster twice is safe. Rows whose email or store does not match are skipped
and listed back, rather than failing the whole import.

### TooEasy API findings

Read from `{base}/swagger/v1/swagger.json` on **2026-09-29** — OpenAPI 3.0.4, title
`tooeasy.External.WebAPI`, version `v1`, 78 paths. The Swagger UI page does not name
the spec file; the path is in its `SwaggerUIBundle` config in the page source.

**Auth** — HTTP bearer JWT, applied globally:

```
POST /api/RequestNewToken/AcquireToken     body { userName, userPw }  ->  JWT
```

Credentials come from `TOOEASY_USERNAME` / `TOOEASY_PASSWORD`, the base URL from
`TOOEASY_BASE_URL`. Nothing is hardcoded, the client is server-only, and a failed auth
response is never echoed into an error message.

**Shifts** — `GET /api/Schedule/GetItemsForAction`, query `startDate`,
`numberOfDaysBack`, `storeId`, `employeeNo`. The response nests four levels:

```
stores[]        Butik      StoreNumber, StoreName
  employees[]   Anstalld   EmployeeId, Firstname, Lastname
    days[]      Dag        Date
      actions[] Pass       StartTime, EndTime, ...
```

#### The three open questions — still open

They cannot be answered without a live account, and **no live call has been made**:
`.env.local` was not present, so `TOOEASY_BASE_URL`, `TOOEASY_USERNAME` and
`TOOEASY_PASSWORD` are unset.

```bash
# Question 1 only — needs nothing but credentials:
npm run tooeasy:probe

# All three — EMP-1234 and the date are examples, replace them with real ones.
# Note: no angle brackets. In zsh `<` and `>` are redirects and a pasted
# placeholder like <EmployeeId> fails with "parse error near \n".
npm run tooeasy:probe -- --employee EMP-1234 --date 2026-10-20
```

That answers all three in one read-only run and prints structure only — field names, shapes, counts and
dates. It never prints the token, credentials, names, personnummer or cost figures;
every value goes through a `describe()` that reports a type, and a forbidden-key list
redacts the rest.

| # | Question | Current behaviour | How the probe settles it |
| --- | --- | --- | --- |
| 1 | Which field holds the JWT? | The spec documents the response only as `200 OK` with **no schema**, so the client accepts a bare string or `token` / `access_token` / `accessToken` / `Token` / `jwt`, strips a `Bearer` prefix, and throws if none match. Expiry is read from `expires_in` / `expiresAt` or decoded from the JWT's own `exp`, falling back to 50 minutes; it renews a minute early and retries **once** on a 401 before failing. | Prints the response's field names and the `exp` claim. Narrow `TOKEN_FIELDS` to the real one afterwards. |
| 2 | What does `numberOfDaysBack` mean? | **Assumed** inclusive at both ends, so a forward range is anchored on its last day and counts back across it (`toDateWindow`). Results are also clipped to the requested range, so a wrong assumption cannot widen the window. | Requests `numberOfDaysBack` of 0, 1 and 2 against a known date and prints which days come back. |
| 3 | Are times local or UTC? | **Assumed** local wall-clock. `wallClock()` slices the literal `HH:MM` out of the string rather than parsing to an instant, because parsing and reformatting applies the server's timezone and moves a shift — by a different amount either side of a DST change. A value carrying `Z` or an offset is **rejected**, not mis-read. | Prints whether `StartTime` carries an offset and says which handling is correct. |

Everything above is covered by tests (`npm test`, 27 cases) using hand-written
fixtures with fake names — no recorded live data. They lock in token parsing, the date
window, DST-safe time slicing, unmapped store and employee skipping, and the data
minimisation rules below.

#### Data minimisation

`Pass` also carries `TotalCost`, `OBCost`, `PayrollTaxes` and `CostExPayrollTax`. Those
are payroll figures: the mapper never reads them, and a test fails if any of those
names — or their values — reach `ShiftEntry`.

`EmployeeMDL` has 76 fields including `PersonalIdentityNum` and `ProtectedIdentity`.
The mapping dropdown is the only thing that reads it, server-side, and
`stripEmployeeRows()` reduces each record to an employee number and a display name
before anything leaves the server. Anyone flagged `ProtectedIdentity` is **excluded
entirely** and only counted, so their name never reaches a page — the admin page says
how many were withheld and that they must be mapped by hand. Tests assert that no
personnummer, email or protected name survives.

Nothing personal from TooEasy appears in the schedule views: the phone and email a
manager sees come from our own `User` record.

### Demo or production? — still unresolved

The Swagger URL we were given is on **`tooeasyDemoNew`**. That path says demo, and it
is not confirmed whether it is throwaway data, a sandbox mirroring production, or the
real account. Until TooEasy confirms:

- `SCHEDULE_PROVIDER` stays **`manual`** in both `.env` and `.env.example`.
- Selecting `tooeasy` without credentials throws a clear error, and the schedule pages
  show a **distinct error state** saying the schedule could not be reached — never an
  empty grid, which would read as everyone being off.
- `/admin/tooeasy` shows a status panel: active provider, whether credentials are
  configured, which environment the URL implies, last successful fetch, and the last
  error message (message only — no secrets, no personal data).

### Caching

Shift fetches are cached in-process for **5 minutes**, keyed by user set and range, so
a dozen managers opening the grid at opening time do not each hit TooEasy. Both
schedule pages have an **Uppdatera** link that bypasses it (`?refresh=1`).

### Scope

Scope is decided on the server from the signed-in user's own record, never from the
request. An ADMIN sees every region; an OWNER sees only the regions of the stores
granted to them in `StoreAccess`. Shifts for a store outside that scope are dropped
even if the provider returns them, and the off-day filter can only name a day inside
the window.

---

## Nyheter (Part B)

**`/news`** is the feed for any signed-in staff member: pinned items first, then newest
first, filterable by category (`NewProduct` / `NewStore` / `General`). Bodies are
markdown, rendered with the same component as the brand pages.

**`/admin/announcements`** (ADMIN only) creates, edits, pins, publishes and deletes.
An item with no `publishedAt` is a draft and never reaches the feed. Editing a
published item keeps its original publish date, so fixing a typo does not bounce it
back to the top.

The three newest also appear as a widget on **`/staff`**. That page is public by
design, so the widget checks for a session itself and renders nothing when signed out —
the brand guide stays readable without an account.

No email or push notifications: in-app only.

---

## Kundönskemål och överföringar

Two coordination tools. **Neither tracks stock.** The app has no live stock
data, and nothing here changes order quantities or suggestions.

### Customer requests — `/requests/new`

One screen: what kind of request, what the customer asked for, send. Staff see
a confirmation and nothing else — the ranking is admin-only.

**No customer personal data, anywhere.** The model has no name, phone, email or
callback field, free text is capped at 120 characters, and a note under every
box says so.

**Deduplication.** The key is lowercased, diacritics stripped and **every
separator removed**, so "Zyn Cool Mint", "zyn cool mint" and "ZYN Cöol Mint"
all land on one row and bump its count. Separators are dropped rather than
collapsed to spaces because collapsing cannot do both jobs: `G.3` and `G3` are
the same brand, while `Extra-Strong` and `Extra Strong` are the same strength —
turning punctuation into a space fixes the second and breaks the first. An
`OUT_OF_STOCK` request keys on the linked **product id** instead, so two people
typing the same sold-out product differently still land on one row.

While you type, matching requests already logged in that store appear with
**"+1 till"**, so the list fills with counts rather than near-duplicates. The
database's `@@unique([storeId, kind, normalizedKey])` is the backstop.

**Entry points:** a quick-action card on `/staff`, and the product finder's
no-results state — "Hittar du inte? Logga som kundönskemål", with the search
text prefilled via `?q=`.

`/admin/requests` ranks by count over 30 or 90 days, filters by store and kind,
carries a status (`NEW`, `CONSIDERING`, `ADDED`, `WONT_ADD`) with a note, and
exports to Excel. No prices and no personal data in the export, because the
model holds neither.

### Transfers — `/transfers`

A structured "can you spare two stockar of X?".

**A request reserves nothing.** The UI says so wherever a transfer is created,
viewed or accepted: there is no stock count to reserve against, and the sending
store decides what it can spare.

**The unit is stored, never assumed.** Each line carries `STOCK` or `CAN`,
because "two" means very different things depending on which.

**First to accept wins.** Accepting is a conditional update inside a
transaction — the row is written only while it is still `REQUESTED` with no
accepting store. Two stores pressing accept at the same moment cannot both
succeed; the second matches zero rows and sees **"Redan tagen av [butik]"**.
The concurrency test fires both accepts with `Promise.allSettled` and asserts
exactly one wins.

**Who may accept.** A targeted request is for that store only. An open request
goes to the rest of the requesting store's `region` — never back to the asking
store, and never across regions unless an ADMIN targeted it explicitly.

Status moves are `REQUESTED → ACCEPTED → SENT → RECEIVED`, with `DECLINED` and
`CANCELLED` as exits. `RECEIVED`, `DECLINED` and `CANCELLED` are terminal, and
the server refuses anything else — a stale page cannot push a transfer
backwards or skip a step.

Tabs are **Inkomna / Skickade / Historik**. STAFF can follow their store's
transfers but cannot create or change them (`/transfers/new` returns 404).
`/transfers/[id]/print` is the följesedel — from, to, date, lines and signature
lines, **no prices**. `/admin/transfers` has all of them with filters.

### Notifications

There was no notification service before this, so this is the minimal in-app
one: a row per recipient at `/notifications`, marked read when you open it.
Fired on request, accept, decline, sent and received.

**In-app only.** Nothing in the app can send email or push — no mail
transport, no web-push keys, no worker. Adding email later means a sender
reading the same rows.

### Navigation

`src/config/navigation.ts` is new — there was no central config, just a
hardcoded array in the header. Routes are registered there with who may see
them, and `SiteNav` reads it. `searchableFor()` exposes the same list for a
future global search; there is no global search in the app yet.

A signed-in user now reaches thirteen destinations, which no header fits
inline, so an entry can also be marked `primary`. The desktop bar shows the
primary ones and a **Meny** button holds everything, grouped by `group`. Below
`lg` only the button shows. It is a `<details>` disclosure, so `SiteNav` stays
a server component and the menu works before hydration.

---

## Butikskommunikation (shift notes, problem reports, routines)

Three small tools for what the stores still did in chat groups and on paper:
hand information between shifts, report problems, and look up "how do we do
X".

**No personal data, anywhere.** Every free-text box in all three carries the
same line — *"Skriv inte kunders namn eller personuppgifter."* — from
`NO_PERSONAL_DATA_SHORT` in `src/lib/privacy.ts`, so the wording cannot drift.
There are no photo or file uploads.

### Shift notes — `/store/notes`

A feed per store. One-tap input at the top: type, pick `INFO` (the default),
`IMPORTANT` or `TODO`, send. Capped at 1000 characters.

**`IMPORTANT` notes are pinned on creation**, which is what "stays at the top
until someone archives it" means in practice. Feed order is pinned, then
`IMPORTANT`, then newest first — the rule lives in `sortNotes` so it is tested
once and used everywhere, rather than being an `orderBy` the tests cannot see.

**`TODO` notes carry a checkbox** that records who ticked it and when.
Un-ticking clears both, because a resolver with no resolution time would be a
half-truth in the feed.

**Nothing is deleted by age.** A non-pinned note older than `ARCHIVE_AFTER_DAYS`
(30, a named constant in `src/lib/shift-notes.ts`) moves to the **Arkiv** tab
and stays there. Archiving also unpins, or a pinned note could never leave.

| | STAFF | OWNER | ADMIN |
| --- | --- | --- | --- |
| Read and write notes for their stores | ✓ | ✓ | ✓ (all stores) |
| Tick a `TODO` | ✓ | ✓ | ✓ |
| Archive / restore | | ✓ | ✓ |
| Delete | | | ✓ |

**Entry point:** a card on `/staff` with the latest three notes and the number
of open `TODO`s, plus the header link. `?store=` narrows the feed for someone
with several stores; it can never widen it, and an id the account cannot reach
falls back to all of its own stores.

### Problem reports — `/store/issues`

Damaged goods, a wrong price label, broken equipment, a delivery problem.
Category, an optional catalog product, a sentence, send — under a minute.

Anyone with access to the store can file one and follow it; status and
assignment are the admin queue's job. `/admin/issues` is ADMIN-only, filters by
status, store and category, counts the open ones, and opens a report's controls
in place via `?issue=`.

Status is `NEW → IN_PROGRESS → RESOLVED`, and **`RESOLVED` can be reopened** —
a fixed fridge breaks again, and a report closed too early is the likeliest
thing to need reopening. It reopens to `IN_PROGRESS`, never to `NEW`: nothing
can become unseen again. The move is checked against the status read inside the
transaction, so two admins clicking at once cannot both apply a change from the
same starting point, and a no-op click adds no second event.

`IssueEvent` is an append-only timeline of status changes, assignments and
comments. Only an ADMIN can be an assignee — checked in the action, because
`role` is a string column rather than a relation.

Notifications: all admins on a new report (minus whoever filed it), the
reporter on every status change and on an admin's comment.

**The prefill hook is built but unused.** `/store/issues/new` accepts `store`,
`product`, `text` and `category` and validates every one of them against the
account and the catalog, so a "Skapa problemrapport" button on a delivery
discrepancy is a link away. There is no delivery or goods-receiving feature in
the app to put it on yet.

### Routines — `/staff/routines`

"How do we do this", separate from the brand pages, which are about products.
Category chips, search, and "senast uppdaterad" on every article. Signed-in
users see published articles; a draft is a 404 for anyone but an ADMIN, so an
unpublished URL cannot be passed around. The article page is print-friendly —
chrome and links are `print:hidden`.

Search matches title **and** body, ignoring case and Swedish diacritics, so
"oppning" finds "Öppning" and a word three paragraphs down still finds the
article. It filters in memory (`filterArticles`): SQLite has no
case-insensitive `contains` through Prisma, and a routine library is tens of
articles. If it grows past that, this becomes an FTS table and the signature
stays.

**A slug is set once, when the article is created.** Retitling a published
routine keeps its URL, because that URL is what a checklist or a note links to.

`/admin/routines` is the editor: markdown with a preview that uses the same
`Markdown` component the staff page does, a publish toggle, and category
management. Deleting a category leaves articles alone — they keep the value
they were filed under and simply stop matching a chip.

**No real routines ship.** `npm run seed:routines` creates one article,
"EXEMPEL – ta bort", explaining how to write them. No procedures, no legal,
compliance, age-check, tobacco or nicotine-rule text, and no categories — the
taxonomy is Pouch Club's to decide. The script is idempotent.

### Tests

`tests/shift-notes.test.ts`, `tests/issues.test.ts` and
`tests/knowledge.test.ts` cover the pure rules — the archive cutoff, feed
order, the status flow, search and slugs. `tests/store-comms.test.ts` is
database-backed on a throwaway SQLite file and covers store scoping (including
that an account with no stores sees nothing rather than everything), archiving,
`TODO` resolution, the issue timeline and two simultaneous status changes.

---

## Struktur och navigering

The portal grew from an order form into eleven features, and the risk stopped
being "missing functionality" and became "too complicated to use in a
stockroom". This is what the simplification pass changed. The measurements
behind it are in [`docs/ux/`](./docs/ux/): `audit.md` (before), `after.md`
(after), and `usability-test.md` (a script for testing it on colleagues).

### "Idag" at `/`

`/` used to be the order form, which calls `requireOrderingUser()` — so **a
STAFF member opening the app got Next's default English 404**. That was the
worst thing the audit found, and it is the reason this page exists.

`/` is now a role-aware home. Every card hides completely when it has nothing
to say or its module is not set up; a greyed-out card is still something to
read and decide about on a phone.

| Card | Who | Shows when |
| --- | --- | --- |
| Ny beställning | OWNER, ADMIN | the catalog has products |
| Fortsätt beställning | OWNER, ADMIN | an `OrderDraft` has lines |
| Ditt pass idag | all | the schedule is live and you work today |
| Checklistor idag | all | your own stores have an unfinished daily list |
| Olästa nyheter | all | something was published since you last opened `/news` |
| Väntar på dig | ADMIN | any action count is above zero |

The checklist card uses the user's **own** stores, not every store an ADMIN
can open — an admin is not personally doing Helsingborgs öppning. It also
reads existing runs rather than calling `getOrCreateRun`, because a dashboard
must not create rows just by being looked at.

The order form moved to **`/order`**. Nothing redirects: the brief puts "Idag"
at `/`, so the two cannot both live there, and the home page's one big button
is the way in.

### Navigation

Everything renders from `src/config/navigation.ts` — bottom bar, "Mer" sheet,
sidebar, admin hub and global search. An entry carries its label, route,
roles, feature flag, group and icon, so a feature added later registers once
and appears everywhere.

- **Phone:** a bottom bar of at most four (Idag, Beställ, Guide, Nyheter with
  an unread badge) plus **Mer**, a bottom sheet holding the rest, grouped.
- **Desktop:** the same groups as a sidebar from `lg` up.
- **Active state** comes from `activeHref()`, longest match wins, with `/`
  matching only itself — otherwise the home entry owns every path in the app.

Two rules this file does not break. **Visibility is not permission**: hiding a
link protects nothing, and every page keeps its own server check. **A module
with nothing in it hides rather than greys out.**

### Feature flags

`src/lib/features.ts` resolves one set of flags per request. A module hides
when it is unconfigured *or* empty:

| Flag | On when |
| --- | --- |
| `ordering` | the catalog has an active product |
| `schedule` | `SCHEDULE_PROVIDER=tooeasy` with all three credentials, or `manual` with at least one imported shift |
| `news`, `routines`, `guide`, `quizzes` | something is published |
| `checklists` | an active template exists |
| `push` | `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` are set — they never are, so push settings never appear |

Types live in `src/lib/feature-keys.ts`, separate from the queries, because
`features.ts` carries `server-only` — a Next bundler alias rather than a real
package, which a `tsx` test process cannot resolve. Same split as
`tooeasy-client.ts`.

### Global search

A magnifier in the header at every width, and `/` on desktop. Searches
products, brands, news, routines and the app's own pages, grouped, scoped by
role — an OWNER never gets an admin page in the results.

Ranking is in `src/lib/search.ts`: a prefix beats a word start beats a
mid-word match, ties break on length. Diacritics fold, so **"rape" finds
"Göteborgs Rapé"** and a phone keyboard without easy å/ä/ö is no handicap.
Recent searches sit in `localStorage` behind try/catch — blocked storage must
never break the header.

### One word for one thing

`src/lib/terms.ts` is the glossary. *stock*, *stockar*, *dosa*, *dosor* and
*antal* were all in use with no definition anywhere; `countOf("stock", 3)`
gives "3 stockar" and the `?` beside the word on the order screen explains
what one is. Swedish plurals are irregular enough that callers must not build
them by appending an "r".

### Admin hub

`/admin` is cards grouped by job — Beställningar, Sortiment, Innehåll,
Personal, Integrationer — each with a "behöver åtgärd" count, and every admin
page carries a breadcrumb back.

The count that used to be printed as plain text with nothing behind it now
has **`/admin/review`**, which lists the products the importer could not parse
and shows each one's raw `Benämning` beside what was parsed.

Three counts the brief asked for do not exist and are **left out rather than
faked**: orders to confirm (`Order` has no status column), delivery
discrepancies (no goods-receiving feature) and catalog previews (the importer
applies directly).

### Shared components

`src/components/ui/` — `PageHeader`, `Card`, `EmptyState`, `ErrorState`,
`Skeleton`, `StatusBadge`, `ConfirmButton`, `Toast`, `TermHint`. Plus the
first `loading.tsx`, `error.tsx` and `not-found.tsx` the app has ever had: a
slow page was a blank screen and a failure was the framework's English default.

`EmptyState` and `ErrorState` are deliberately different components. An outage
that renders as "nothing here" is at its worst on a schedule, where an empty
week and a broken week look identical and only one of them means you are off
work.

---

## Beställningsflödet

The order screen is the most-used in the app, so it gets the most care.

### Drafts that do not get lost

`OrderDraft` is one row per user and store — someone covering two stores keeps
a separate basket for each. Lines are a JSON document rather than rows,
because a draft is written on nearly every change and read whole; rows would
mean a delete-and-insert per autosave.

Autosave fires **a second after the last change**. Three things can happen:

- **It saves.** Silently. A "Sparat" that never goes away is noise.
- **It fails.** The local copy in `localStorage` already holds the work — it
  is written synchronously on every change, so it survives a tab dying before
  the debounce fires. The banner says *"Sparas inte just nu, försöker igen"*
  and it retries every five seconds.
- **It conflicts.** The client sends the `version` it last saw. If the stored
  version moved on, the same draft was edited somewhere else, and overwriting
  it would throw away work nobody can get back. The save is **refused**, and
  the person picks: *Hämta den senaste* or *Fortsätt med min*.

The version check and the write are one transaction, so two tabs saving at the
same instant cannot both believe they won.

A draft can outlive a catalog re-import, so lines whose product is gone are
pruned on load and the person is told how many went. The draft is deleted
**server-side** when the order is submitted — a browser closed on the
confirmation screen would otherwise leave "Fortsätt beställning" pointing at
an order already sent.

### Picking, reviewing, sending

Sticky search and category chips, brands collapsed until searched, a
**"Visa bara valda"** chip once anything is chosen, and the last category
remembered per device. The −/+ stepper was already 44px and typable.

**Granska** is a separate screen, not a modal: the list is as long as it needs
to be and the back button behaves. Lines are grouped by brand and editable in
place. One primary action.

After sending: **Exportera Excel**, **Se beställningen** (`/orders/[id]`, which
did not exist before — the confirmation could only offer the whole list) and
**Ny beställning**.

### Beställ samma igen

The most common restock is "the same as last time", which previously meant
reading the old order and retyping every line. `/orders` now has a one-tap
**Beställ samma igen** per order: it loads those lines into the draft for that
store and opens the form. A draft, not an order — the point is to save the
typing, not to send something nobody looked at.

### Which price the total uses

**`pricePerStock`, which is `Inpris` × `unitsPerStock` — what the store pays,
not the shelf price.** So the figure under the summary bar is the order's
**cost** to Pouch Club, and it is now labelled "inköpsvärde" rather than left
as a bare kr figure.

The calculation is untouched. Whether store staff should see a cost figure at
all is a decision for you, not for this codebase; if the answer is no, the
change is to hide `totalSek` in `SummaryBar`, `ReviewStep` and
`OrderConfirmation`, and the Excel export is unaffected either way.

---

## Butiksverktyg (shop floor tools)

Four staff-facing tools: a product finder, checklists, onboarding and quizzes.

### The STAFF role

`ROLES` is now `STAFF | OWNER | ADMIN` (`src/lib/roles.ts`). There was no
staff-like role before — only OWNER and ADMIN — so this one is new.

| | STAFF | OWNER | ADMIN |
| --- | --- | --- | --- |
| `/staff/*`, finder, `/news`, `/schedule`, checklists, quizzes | yes | yes | yes |
| `/order` and `/orders` (ordering) | **no** | yes | yes |
| `/store/schedule`, `/store/employees` (writing the rota) | **no** | yes | yes |
| `/schedule/available`, `/schedule/extra` (other stores' staff) | **no** | yes | yes |
| `/admin/stores/[id]/hours` | **no** | own store | yes |
| `/admin/*` otherwise | **no** | **no** | yes |

Pages and routes ask the capability helpers (`canPlaceOrders`,
`canViewTeamSchedule`, `canEditSchedule`, `canManageEmployees`,
`canViewAvailability`, `canEditOpeningHours`, `canManageNearbyStores`,
`canAccessAdmin`, `canActOnStore`) rather than comparing role strings, so a
fourth role means editing one file. Checks are server-side; a hidden nav link is
not a permission. Verified end to end — signed in as each role in turn, a STAFF
account renders `/schedule` and nothing else in that list, and an OWNER renders
everything except the two ADMIN-only pages.

`/admin/stores/[id]/hours` is the one page under `/admin` that is not ADMIN-only,
so it cannot use `requireAdmin`: an OWNER edits their own store's hours there, and
the per-store check is the whole protection.

Create staff accounts at `/admin/users`. Every non-ADMIN account needs at least
one store, or it has no checklists and no schedule to show.

### Product finder — `/staff/finder`

Open without a login, like the brand pages, and `noindex`.

Filters: category, nicotine strength, format, flavour group and free text.
Strength uses four fixed ranges from `src/lib/strength.ts` — **up to 6**,
**7–11**, **12–16**, **17 and above** mg. There are deliberately no labels of
our own like "mild" or "strong": brands use those words with their own
meanings, so the card shows the brand's own wording ("Regular", "Extra Strong")
verbatim alongside the milligrams.

**No stock information anywhere.** We have no live stock data, and implying it
would have staff promising what the shelf cannot back up.

### Flavour groups

All rules live in `src/lib/flavor-tags.ts`. Keywords are Swedish and English,
because flavour names are parsed from supplier product names and mix both.
Groups: mint, fruit, berry, citrus, tropical, cola, liquorice, sweet.

A flavour can be in several groups — "Blueberry Mint" is berry *and* mint. One
that matches nothing gets **no tags at all** rather than a fallback group, so
"nobody has sorted this yet" stays distinguishable from a guess.

Two mechanisms stop short keywords misfiring, both of which the tests pin down:

- **Whole-word matching** for keywords short enough to hide inside other words.
  `ice` is inside *juice*, `pear` inside *spearmint*, `one` inside *lemonade*.
- **Specific compounds** resolved first and then removed from the string:
  *körsbär* ends in "bär" but is a fruit, *grapefruit* contains both "grape"
  and "fruit" but is citrus, *pineapple* ends in "apple" but is tropical.

```bash
npm run flavors:retag          # derive tags; skips hand-edited rows
npm run flavors:retag -- --force
```

`Product.tagsEditedByAdmin` is set when an admin sorts a product by hand at
**`/admin/flavor-tags`**, and the re-tagging job skips those rows — so a
catalog re-import can never undo hand-sorting.

### Checklists and onboarding

Four types: `ONBOARDING`, `STORE_OPENING`, `DAILY_OPEN`, `DAILY_CLOSE`.

**A run copies the template's items when it is created.** `ChecklistRunItem`
holds its own title, description, link and required flag, so editing,
reordering or deleting template items afterwards never rewrites a list someone
has already started. That is the behaviour the snapshot tests exist to protect.

Daily runs are one per store per day, created the first time someone opens the
list that day — so a day nobody worked leaves no empty run behind. The date key
is **Europe/Stockholm**, not UTC: a closing list worked at 23:30 local in summer
is already "tomorrow" in UTC, which would split one evening across two runs.

Ticking records who and when. Unticking is allowed for whoever ticked it, or an
admin, so one person cannot quietly undo another's work on a shared store list.
Each run item takes a free-text note.

- `/staff/checklists` — daily lists for the stores you work in
- `/my-onboarding` — your own introduction
- `/admin/checklists` — templates, items, reordering, assigning onboarding
- `/admin/checklists/today` — per store, today's progress, plus onboarding per person

### Quizzes

- `/staff/quizzes` — login required, so attempts can be attributed
- `/admin/quizzes` — write and reorder questions, publish
- `/admin/quizzes/results` — best and latest per person and quiz, filterable by store

One question at a time, with the answer and explanation revealed immediately.
Retakes are unlimited and every attempt is kept; the list shows best and latest.
Before a quiz starts, staff are told their result is visible to their manager.

Results are visible to the person and to ADMINs only — `listAttemptSummaries`
takes the scope as an argument and the staff page always passes its own user id.
The score is recomputed on the server from the stored answers, so the browser
cannot report a score it did not earn.

### Starter content

```bash
npm run seed:shopfloor     # idempotent
```

Four checklist templates and one quiz, every title and item prefixed
**"EXEMPEL –"** and deliberately generic — nothing legal, nothing about age
checks or tobacco and nicotine rules, nothing about brands. The quiz is seeded
**unpublished** and asks about ordering terms in this app. Replace it before
anyone relies on it.

### Tests

```bash
npm test     # node --test, no new dependency
```

Covers flavour tagging (42 real catalog flavour names plus the substring traps),
strength parsing and range boundaries, the role capability matrix and store
scoping, and the checklist snapshot behaviour. The checklist tests run against
a throwaway SQLite file, never `prisma/dev.db`.

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

Skruf, Knox, ZONE, X, Smålands Brukssnus, Velo and XQS have content written by hand (`npm run seed:brand-content`).
The text is ours, written from factual sources — Skruf's own account of its
production in Sävsjö, manufacturer figures, and the strength spread in our catalog.
No marketing copy from a brand's or a competitor's site is reproduced, and that is
the line to keep when adding the rest: take the facts, write the words.

Knox, ZONE, X and Smålands Brukssnus all come out of Skruf's plant in Sävsjö, so
their pages link back to the Skruf page for the production detail instead of
repeating it. That was checked, not assumed: X's own site names Sävsjö, and the
enriched catalog independently lists "Skruf Snus" as the manufacturer for all four.

Long-form fields render GitHub-flavoured markdown, tables included (`remark-gfm`) —
the ZONE page uses one for its strength key.

Re-running that script overwrites those brands, so once you have edited a page
at `/admin/brands/[id]`, edit it there rather than in the script.

### Supplier content — `content/brands/*.md`

Separate from the hand-written pages above. These files hold what a supplier
told us, imported idempotently:

```bash
npm run brands:import            # fill empty fields only
npm run brands:import -- --force # overwrite what is already there
```

Rules the script keeps, because supplier material is not our words:

- **Never overwrites an edit.** A field with content is skipped and reported as
  skipped, unless `--force`.
- **New prose takes the page down.** Writing `shortDescription`,
  `manufacturingProcess` or `blendingNotes` sets `published = false`, so nobody
  reads unreviewed supplier claims on a live page. A run that writes *nothing*
  leaves `published` alone — an earlier version unpublished Fumi, Helwit and
  XQS on every no-op run, which undid a decision someone had already made.
- **Metadata does not take the page down.** `countryOfOrigin`, `websiteUrl` and
  `strengthUnit` are facts, not claims.
- **It never creates a Brand.** Brands come from the catalog; a file naming one
  we do not stock is reported and skipped.

Two ways to attach text to products:

| Section | Key | Used by |
| --- | --- | --- |
| `## products` | our `sku` | XQS, whose product sheet has article numbers |
| `## flavors` | flavour name | Loop, whose deck has none |

Flavour matching folds case, diacritics and whitespace — the deck says
"Jalapeño Lime" and our masterdoc says "Jalapeno Lime" — and nothing else. No
stemming and no fuzzy distance: `Hot Mango` must not match `Mango Chili`. The
rule is `src/lib/flavor-match.ts` and is tested.

Reading a draft: an unpublished brand page is visible to an ADMIN with an
**Utkast** banner, and 404s for everyone else. Without that there was no way to
read supplier text before publishing it, which is exactly what the import asks
a human to do.

### Loop (Another Snus Factory)

Source: `content/source/loop/ASF_LOOP INTRO 202602.pdf`, 17 slides, February
2026 — gitignored like the other supplier material. The text in it is largely
image-based, so the slides were read as rendered images, not extracted text.

Used: slide 3 (company), 4 (brand promise), 10 (awards), 11 (categories and
flavour description), 12 (nicotine and strengths), 13–16 (flavour and strength
grids). **Skipped:** 5–9 and 17 — tonality, the brand journey, wordmarks, logo
variants and advertising stills. None of it helps anyone behind a counter.

The deck gives no process description beyond "produktionsanläggning strax norr
om Stockholm", so `manufacturingProcess` says exactly that and then says no
more was provided. Nothing generic about how pouches are made was added. No
logo or slide graphic was copied; `logoUrl` and `heroImageUrl` stay empty, and
the deck states no website.

### Strength units — mg/g is not mg/påse

`Brand.strengthUnit` (`MG_PER_G` | `MG_PER_POUCH` | null) records how a
supplier states strength, because they disagree: **Loop quotes mg per gram,
XQS quotes mg per påse.** Loop's "25 mg/g" and our "14,8 mg" for the same can
are both correct and measure different things.

The brand page prints the unit beside the figure and explains the difference.
Nothing converts between them — the conversion needs a pouch weight nobody has
given us. Null is a real value meaning "not told", which is not the same as
either unit.

**The product finder was deliberately left alone**, and what it does today is
worth knowing. Its mg figure comes from `strengthMg()`, which prefers
`nicotineMgPerPortion` (per påse, matched in from snusbolaget.se by EAN) and
otherwise parses a number out of the `strength` text. Across 1088 active
products:

| Source of the mg figure | Products |
| --- | ---: |
| `nicotineMgPerPortion` — per påse | 529 |
| parsed out of the strength text | 245 |
| none; the finder shows "mg okänt" | 314 |

Loop is safe: 39 of its 40 active products take their figure from
`nicotineMgPerPortion`, so the deck's mg/g numbers never reach the finder.

The real mismatch is not mg/g at all — **it is vapes.** Frunk Bar, VEEV and
Vozol are `category = "Vape"`, and their parsed "20mg" is e-liquid strength,
not nicotine per portion. 56 active vapes currently sort and display on the
same mg scale as pouches. `X-Booster` is a second case: two products at
**80mg**, categorised as a pouch, which is not a per-påse figure either.

Smallest fix, when you want it: have `strengthMg()` return null for products
whose category is not a pouch, which drops vapes out of the mg sort and shows
them as "mg okänt" instead of ranking them against pouches. That is one
condition in `src/lib/strength.ts` plus a test. It is not in this task.

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
    schedule/            ScheduleProvider seam + CSV/ICS import
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
