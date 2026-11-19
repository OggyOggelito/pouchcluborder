# Örebro vs. Pouch Club — field by field

Fill this in with the answers from `intake.md`. One row per field. The
**Decision** column is the point of the document: a gap with no decision is a
bug waiting to be shipped.

Decisions are one of:

- **Keep ours** — their field maps onto something we already have.
- **Adopt theirs** — we add it. Say whether it is required.
- **Both** — the two mean different things and both survive, under different names.
- **Drop** — nobody uses it. Say who confirmed that.
- **Open** — not decided yet. Name who decides.

---

## Products

| Field (ours) | Type | Field (theirs) | Type | Gap | Decision | Who decided |
| --- | --- | --- | --- | --- | --- | --- |
| `Product.brand` | string | | | | | |
| `Product.flavor` | string | | | | | |
| `Product.strength` | string | | | | | |
| `Product.format` | string | | | | | |
| `Product.sku` | string? | | | | | |
| `Product.eanKfp` / `eanDfp` | string? | | | | | |
| `Product.pricePerStock` | float | | | | | |
| `Product.costPrice` | float? | | | | | |
| `Product.unitsPerStock` | int? | | | | | |
| `Product.supplier` | string? | | | | | |
| `Product.active` | bool | | | | | |
| — | | | | | | |

**Business key.** Ours is `@@unique([brand, flavor, strength, format])`, with
`sku` as the supplier's real key. Theirs: ______. If the two disagree, this row
decides the whole import.

## Stores

| Field (ours) | Type | Field (theirs) | Type | Gap | Decision | Who decided |
| --- | --- | --- | --- | --- | --- | --- |
| `Store.name` | string, unique | | | | | |
| `Store.slug` | string, unique | | | | | |
| `Store.region` | string? | | | | | |
| — | | | | | | |

## Orders — header

| Field (ours) | Type | Field (theirs) | Type | Gap | Decision | Who decided |
| --- | --- | --- | --- | --- | --- | --- |
| `Order.storeId` | relation | | | | | |
| `Order.submittedAt` | datetime | | | | | |
| `Order.note` | string? | | | | | |
| `Order.placedByUserId` | relation? | | | | | |
| *(no status column)* | — | | | | | |
| *(no delivery date)* | — | | | | | |
| *(no goods receiving)* | — | | | | | |

## Orders — lines

| Field (ours) | Type | Field (theirs) | Type | Gap | Decision | Who decided |
| --- | --- | --- | --- | --- | --- | --- |
| `OrderLine.productId` | relation | | | | | |
| `OrderLine.quantity` | int, **stockar** | | | | | |
| `OrderLine.unitPrice` | float, cost at submit | | | | | |
| `OrderLine.lineTotal` | float | | | | | |

**Unit.** Ours counts stockar (cases). Theirs counts ______. Conversion:
______. This is the single most dangerous row in the document — getting it
wrong changes every quantity by a constant factor and looks plausible.

**Price.** Ours is the store's cost at the moment of submitting, copied so a
later price change cannot rewrite history. Theirs: ______.

## Suppliers

| Field (ours) | Type | Field (theirs) | Type | Gap | Decision | Who decided |
| --- | --- | --- | --- | --- | --- | --- |
| `Brand` (editorial) | record | | | | | |
| `Product.supplier` | string? | | | | | |
| `SupplierUser` (portal login) | record | | | | | |

## Users and roles

| Ours | Theirs | Gap | Decision | Who decided |
| --- | --- | --- | --- | --- |
| `STAFF` | | | | |
| `OWNER` | | | | |
| `ADMIN` | | | | |
| `SupplierUser` (separate table, separate login) | | | | |

## Things theirs has and ours does not

One row each. These are the reason the merge is being discussed at all.

| Theirs | What it does | Used how often | Who relies on it | Decision |
| --- | --- | --- | --- | --- |
| | | | | |

## Things ours has and theirs does not

So the merge does not quietly take something away from the other four shops.

| Ours | What it does | Who relies on it | Decision |
| --- | --- | --- | --- |
| Customer requests | | | |
| Store-to-store transfers | | | |
| Shift notes, problem reports, routines | | | |
| Teamschema and extra shifts | | | |
| Checklists, quizzes, onboarding | | | |
| Brand guide and product finder | | | |
| Supplier portal and demo days | | | |
