# Supplier portal — what was built, and what you need to decide

Three things landed together: a separate front door with two logins behind it,
a supplier portal with demo-day booking and sales statistics, and an order
pause. This is the report that goes with them. How it works is in the README.

---

## 1. Which account to give `canViewStats`

**You need to decide this and set it; nobody has it today.**

Reading a supplier's sales figures takes the ADMIN role **and** a per-account
`canViewStats` flag, off by default. I did not hard-code a name: the brief said
only Christian's admin account should see it, and a name in a condition is a
thing that outlives the person. It is a permission, set at
**Admin → Leverantörskonton**, at the bottom of the page.

Today the only ADMIN account in the database is `admin@pouchclub.se`
("Pouch Club Admin"), which looks like a shared login rather than Christian's
own. Two things to sort out, in this order:

1. **Give Christian a named admin account** at `/admin/users` if he does not
   have one. A shared admin login cannot carry a permission that is meant to
   be one person's.
2. **Switch `canViewStats` on for that account** and leave it off for every
   other admin, including the shared one.

With it off, `/admin/stats` answers as if it does not exist — no card on the
admin hub, no search hit, nothing on the page. **That is the state I left it
in, and it is what I verified**: the refusal, not the granted view. I did not
switch the permission on for your shared admin account, because who may read a
supplier's commercial figures is your decision and not something to set from a
script. The granted view is one click away at the bottom of
**Admin → Leverantörskonton** — and it renders the same `SalesView` component
as the supplier page, which is screenshot-verified.

## 2. How supplier isolation is actually enforced

Four independent layers. Any one of them failing is caught by the next.

**A separate table.** Supplier logins are `supplier_users`, not `users`. Every
staff query that lists people reads `users`, so there is no forgotten filter
that could put a supplier on an internal screen — the user list, the
notification audience, the employee account picker and the role picker
literally cannot return one. `SUPPLIER` is deliberately **not** in `ROLES`.

**A separate session, on a separate path.** The supplier portal is a second
complete Auth.js instance with its own cookie, `pc-supplier.session-token`,
scoped to `/supplier`. A browser never sends it to a staff route. A supplier
session is not merely refused in the staff app — it does not arrive there. The
staff cookie keeps its path of `/` and so does reach `/supplier`, which is how
the portal can answer "du är inloggad som personal" instead of a login loop.

**A separate lookup.** Each door's `authorize` reads one table. A supplier
email typed into the staff form finds nothing and gets the same "Fel e-post
eller lösenord" as any wrong password; a staff email in the supplier form, the
same. Neither form can be used to discover whether an account exists on the
other side.

**Brand scoping with no way to widen it.** `getBrandSales` takes a brand id and
has no "all brands" branch. The id comes from the session, never from a query
string or a form field — the booking form has no brand input at all. Every
supplier write re-checks the brand in the repository as well as in the action.

Tested in `tests/supplier-doors.test.ts` (the whole routing matrix, as a pure
function of a request) and `tests/supplier-portal.test.ts` (a supplier is
absent from staff lists; one brand's query returns only that brand; one brand
cannot cancel another's booking).

### The one compromise, named

The entry page at `/` cannot see the supplier session, because that cookie is
pinned to `/supplier` — which is the property worth keeping. So a small
`pc-portal` cookie at path `/` records that this browser last came in through
the supplier door, and `/` uses it to route. It contains the literal string
`supplier`: no id, no email, no brand. A staff session always wins over it, and
signing in as staff clears it. If you would rather not have it at all, delete
`src/lib/portal-cookie.ts` and its three callers; the cost is that a signed-in
supplier opening `/` sees the two choices and taps "Leverantör" — one extra tap.

## 3. What I must obtain from the statistics lead

The whole list is in [`sharp-api-intake.md`](sharp-api-intake.md). The four
that change the most code:

1. **Is a row a receipt line or a day's total?** We store daily totals and want
   nothing finer. If Sharp returns receipt lines we aggregate at the boundary
   and discard the rest.
2. **Does the feed carry a cashier, a till or anything about a customer?** If
   it does, the integration strips it before it is written, and that needs
   saying in writing — see the privacy questions below.
3. **Are amounts with or without VAT, and are returns included?** A supplier
   reading "Försäljning" assumes one answer.
4. **Which timezone, and when does a trading day end?** We store Swedish local
   dates. A till that puts a 00:15 sale on the previous trading day and an app
   that does not will disagree by one day, every day.

Until those are answered, `SALES_PROVIDER=sharp` throws a clear error and the
manual CSV import is the working path.

## 4. What I must obtain from Örebro

[`orebro-merge/intake.md`](orebro-merge/intake.md) is the full list. The three
that decide whether a merge is a week or a quarter:

1. **Is a quantity a can or a stock?** Ours is a stock. If theirs is cans and
   nobody notices, every number is out by the case size and still looks
   plausible.
2. **What does their system do that ours does not, and who actually uses it?**
   A feature built and never used is not a requirement.
3. **Merge, replace, or coexist?** Three different projects. Nothing should be
   built before somebody answers it.

No merge code exists, as asked. `docs/orebro-merge/source/` is where the code
or a dump goes when you have it.

## 5. Privacy and contract questions this raises

**The sales feed may carry things we must not store.** A till system knows the
time of a sale, the till, the operator and sometimes the customer. None of it
belongs in a supplier's statistics, and an operator id is personal data about
an employee. Our schema has no column for any of it and the importer has no
path that would write one — but the moment Sharp is connected, whoever
implements it has to strip at the boundary. Worth a line in the agreement with
Sharp as well as in the code.

**A supplier's sales figures are commercial data about us as well as them.**
The portal shows a supplier their own brand and nothing else: no other brand's
numbers, no ranking, no market share, no cost prices or margins. Market share
is the interesting one — it looks harmless and is arithmetic away from a
competitor's volume. **It is not built.** If the statistics lead asks for it,
it should be an ADMIN-only figure, off by default, and somebody should decide
whether showing it is consistent with what we have told the other suppliers.

**Is there anything in the supplier agreements about data?** Before a supplier
logs in and sees sales figures, somebody should check whether the agreements
say anything about reporting — what we are obliged to share, what we are
obliged not to, and whether a self-service portal changes either. This is a
question for whoever owns those contracts, not for the code.

**Supplier accounts are personal data too, thinly.** We store an email, an
optional name and a password hash. There is no phone number, no address, no
company contact record, and the admin form has no box for one. When a supplier
relationship ends, deactivating the account at **Admin → Leverantörskonton**
stops the login and voids any outstanding link; the bookings stay, because they
are a record of what happened in the shops.

**No email is sent, anywhere.** This app still has no mail transport. That has
two consequences you should know about rather than discover:

- A supplier is told a booking was answered **in the portal** — a "svar sedan
  sist" marker on their start page — and not by email. If suppliers will not
  log in to check, this needs an email sender before it is useful.
- An invite or reset **link** is shown to the admin once, on screen, and never
  stored. You copy it into whatever channel you already use to talk to that
  supplier. The token is kept only as a hash, which is why it cannot be shown
  again.

**Small numbers are not suppressed, deliberately.** The brief asked me to judge
and report. Daily figures per store and product are not personal data: there is
no customer, no time of day, no till and no operator in the row. The parties are
us and the supplier, and the supplier already knows what they shipped us. So a
day where one can sold reveals nothing about a person, and hiding it would cost
a supplier real information about a slow product. The protection that matters is
the **grain** — daily totals, never receipts — and that is enforced in the
schema, not in a display rule. The one scenario worth keeping in mind: a shop
with a single employee on a quiet day, where somebody who was there could in
principle connect a figure to a person they served. It is a stretch, the data
has no time of day, and I did not think it justified suppression. Say the word
if you disagree and it becomes a threshold in one function.

## 6. Assumptions I made

**`SUPPLIER` is an actor, not a staff role.** The brief said "a new role
`SUPPLIER`". I put suppliers in their own table with their own session instead
of a fourth value in `ROLES`, because the brief also said the role must never
appear in any staff user list — and a separate table makes that a property of
the schema rather than a filter somebody has to remember. The authorization
layer has it as a first-class actor with its own guards
(`src/lib/supplier-session.ts`).

**A store hosts at most one live demo day per date.** Enforced in a
transaction, not by a unique constraint: a declined or cancelled booking frees
the day, and "unique unless the status is one of these three" is not something
a constraint can say.

**A blocked store says "Redan bokad" and nothing else.** Naming the brand that
holds the day would tell one supplier what another is doing.

**Booking limits are constants at the top of `src/lib/demo-days.ts`:** at least
7 days ahead, at most 60, cancellable up to 3 days before, note max 300
characters. All four are judgement calls and all four are one line to change.

**A brand pause only bites when the basket contains that brand.** Pausing one
supplier must not stop a store ordering everything else.

**An admin override needs a typed reason and is logged** against the pause,
with the account and the order id. It is offered only to an ADMIN, and the
order screen explains what still works instead of just refusing.

**Demo days appear in the staff menu once the first supplier account exists.**
Before that the queue would always be empty.

## 7. Demo data in `prisma/dev.db`

For testing. Everything it writes is fake and removable:

```bash
npm run seed:supplier-demo            # two supplier logins + 60 days of invented sales
npm run seed:supplier-demo -- --remove
```

The accounts are on `@example.test` addresses with the password
`demo-losenord-1234`, and the sales rows are generated from a fixed seed, so two
runs produce the same numbers. The removal deletes exactly what the seed made.

There is also one account, `demo.leverantor@example.test`, created by hand while
building this; `--remove` deletes it too, since it is on the same domain.

**I switched `SALES_STATS_ENABLED="1"` on in your `.env`** so the statistics
pages are reachable while you look at them. Set it to `""` to turn the whole
module off again — routes, menu items and the supplier's tab all disappear.

## 8. Not built, as agreed

Real Sharp integration, supplier invoicing, supplier access to orders or
prices, payments, supplier messaging, customer-facing pages — all out of scope.
No Örebro merge code.
