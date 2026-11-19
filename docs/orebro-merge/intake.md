# Örebro's order system — what to find out

A colleague in Örebro has built a more detailed ordering system. We have not
seen it: no repository, no screenshots, no database. Nothing in this folder
assumes anything about it, and no merge code exists.

This is the list to work through with them, ideally sitting in front of the
running system. Answers go in `comparison-template.md`.

If you are given code or a database dump, put it in `docs/orebro-merge/source/`
and a follow-up task can analyse it.

---

## 1. What it is

- What problem did it solve that our portal does not? Ask for the story, not the feature list — the answer is usually one specific frustration.
- Who uses it, in which shops, and how many people?
- Is it in daily use, or a prototype? What breaks if it stops tomorrow?
- Is anything downstream depending on it — a spreadsheet, a supplier who receives its output, an accountant?

## 2. The stack

- Language, framework, how it is hosted and by whom.
- Database: which engine, where it runs, who can take a backup, and **can we have one**?
- Authentication: who can sign in, and is it the same people as our portal?
- Is the source in version control, and where?
- Is there anything scheduled — jobs, emails, exports?

## 3. The data model

For each of these, ask: what are the fields, what is required, and what is the business key?

- **Products** — does it keep its own catalog, or point at ours? What identifies a product: EAN, article number, a name?
- **Suppliers / distributors** — is a supplier a first-class record there? Ours is a string on `Product.supplier` plus the editorial `Brand`.
- **Stores** — a table, or a column? How many stores does it know about?
- **Orders** — header fields, line fields, and what a line's quantity is counted in.
- **Statuses** — the exact list, and what causes each move. Ours has none: an `Order` is submitted and that is all it records.
- **Users and roles** — who may do what.
- Anything with no equivalent on our side at all. This is the valuable part of the conversation.

## 4. Units and prices

Our two ambiguities, and the ones most likely to differ:

- Is a quantity a **can** or a **stock** (a case of cans)? Ours is a stock, with `unitsPerStock` on the product. If theirs is cans and we merge naively, every number is out by a factor of ten to twenty.
- Which price does an order line carry — cost price, shelf price, with or without VAT? Ours prices each line from the catalog at submit time using `pricePerStock`, which is the store's **cost**.
- Does it handle discounts, campaign prices or supplier agreements? We do not.
- Is anything rounded, and where?

## 5. What it does that ours does not

Ask for a demo and write down each thing, with how often it is used:

- Goods receiving — recording what actually turned up?
- Order statuses, confirmations, expected delivery dates?
- Stock levels, minimum and maximum, automatic suggestions?
- Supplier-specific order formats or files?
- Reporting we do not have?

For each: is it used weekly, monthly, or was it built and never used? A feature nobody uses is not a requirement.

## 6. Exports and integrations

- What does it export, in which format, and who receives it?
- Does it talk to any other system — an ERP, an accounting package, a supplier's portal?
- Is any of that a contractual commitment to somebody outside the company?

## 7. The decision behind the question

Before any of this becomes code, somebody has to answer:

- **Is the aim to merge the systems, or to replace one with the other?** They are very different projects.
- If merging: which system is the one that survives, and is Örebro expected to change how they work?
- Who owns the result afterwards?
- Is there a date this has to happen by, and what is driving it?

The honest answer to the first question decides whether anything in
`migration-principles.md` applies at all.
