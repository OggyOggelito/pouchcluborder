# Merging safely — the rules before any code

Written before we have seen the Örebro system, deliberately. These are the
constraints a merge has to satisfy whatever it turns out to contain; if one of
them has to be broken, that is a decision for a person and not for whoever is
writing the import.

---

## 1. Production data is never overwritten

Not "rarely", not "only when the mapping is confident". Never, as a property of
how the import is built:

- Their data lands in **staging tables** — `staging_*`, separate from the live
  ones — and is read, reported on and corrected there.
- A row only moves into a live table through an explicit, reviewed step.
- An import never issues an `UPDATE` against a live row that a person has not
  seen named in a dry-run report.
- `npm run db:push` is not a migration strategy for this. The SQLite file is
  backed up first, as every other change in this project has been (`backups/`).

## 2. Dry run first, always

The import runs in two modes and the default is the one that writes nothing.

A dry run reports, per entity:

- how many rows matched an existing record, and on which key;
- how many would create a new record;
- how many are **ambiguous** — matched more than one, or matched on a weak key;
- how many could not be matched at all, listed in full, not counted;
- every field where the two systems disagree about an existing record.

The disagreement list is the one that matters. "412 produkter matchade" is not
a result; "412 matchade, varav 37 har ett annat pris" is.

## 3. Nothing is matched on a name

Names are not keys. "Loop Mango 12" is several products in two formats, and a
name match that is right 95 % of the time is a quiet 5 % of wrong figures.

Match on, in order: EAN, then article number, then nothing. A row that matches
on nothing goes to the unmatched list for a person to resolve — exactly as the
sales importer already does.

## 4. There is a way back

Before the first write to a live table:

- a timestamped copy of `prisma/dev.db` (or the production database) exists and
  somebody has tested restoring it;
- every row written by the import is **marked** as such — an import id on the
  row, the way `SalesDaily.importId` works — so one run can be identified and
  undone;
- the undo is written and tested **before** the import is run for real, not
  after it goes wrong.

An import you cannot reverse is not an import, it is a decision.

## 5. Nobody loses a feature

Five shops use this portal today and one uses theirs. The merge must not take
anything away from either side:

- The "Things ours has and theirs does not" table in
  `comparison-template.md` is a checklist, not a note.
- If a feature genuinely goes, the people who use it are told before it does,
  by name.
- A feature that is used by one shop and nobody else is still used.

## 6. One system, or two, decided before the code

The three honest outcomes are:

1. **Örebro adopts the portal**, and the features they would lose are built here first.
2. **The portal adopts their ordering**, and the other four shops change how they order.
3. **Both keep running** with a defined boundary, and nobody pretends that is temporary.

Each is a real project with a different cost. Writing an import before this is
answered means building for whichever one turns out to be wrong.

---

## Decisions needed before any code is written

Write the answers down; the import's shape follows from them.

| # | Decision | Who decides |
| --- | --- | --- |
| 1 | Merge, replace, or coexist (section 6) | |
| 2 | Which system's **product catalog** is the source of truth | |
| 3 | Which **unit** an order line counts — cans or stockar — and how the other converts | |
| 4 | Which **price** an order line carries, and whether it includes VAT | |
| 5 | Whether order **statuses** come into our model, and the exact list | |
| 6 | Whether **goods receiving** is in scope, and for whom | |
| 7 | What happens to Örebro's **order history** — imported, archived read-only, or left where it is | |
| 8 | Who owns the merged system afterwards, and who maintains it | |
| 9 | Whether anything outside the company (a supplier, an accountant) depends on their exports | |
| 10 | The date this has to be done by, and what is driving it | |

## What is deliberately not here

No merge code, no schema changes, no staging tables. All of it would be built
on guesses about a system nobody on this side has opened. When the code or a
dump lands in `docs/orebro-merge/source/`, that is the point to start.
