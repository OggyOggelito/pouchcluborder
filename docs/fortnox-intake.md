# Fortnox — what we need before anyone writes the integration

Nothing is built. There is no Fortnox code in this repository, no token
storage, no schema and no stub, and that is deliberate: Fortnox is not one API
but a dozen — bookkeeping, supplier invoices, customer invoices, orders,
articles, payroll — and which of them matters depends entirely on what Tobias
does by hand today.

This is the list to work through. Sections 0 and 1 are the ones that decide
whether there is a project here at all; everything after them is detail.

---

## 0. The question before the questions

**Which number is Tobias assembling by hand each month, out of what?**

One concrete task, start to finish, with the spreadsheet open. Not a feature
list. The answer decides the direction of the integration, and the direction
decides everything else.

Worth asking in the same sitting:

- How long does it take him now, and how often?
- What goes wrong with it today — is it slow, or is it wrong?
- Who else reads the result?
- Would he rather have the figure **in Fortnox** (so his existing reports pick
  it up) or **in this portal** (so he can see it next to orders and sales)?

That last one is the fork. See section 2.

## 1. What this app actually holds

Worth saying out loud before anyone promises "economy oversight", because the
honest answer is: **not much of it.**

| We have | We do not have |
| --- | --- |
| What each store ordered, and what it cost at the time (`Order`, `OrderLine.unitPrice`) | Invoices, of any kind |
| The catalog, with cost price, shelf price and case size | Payments, due dates, payment status |
| Stores, and who ordered for them | Supplier terms, credit notes, reminders |
| Daily sales per store and product — **once Sharp is connected** | Margins, stock value, shrinkage |
| Demo-day bookings | Payroll, hours, employer cost |
| | A chart of accounts, cost centres, VAT codes |

So "economy oversight over the whole company" is mostly data this portal does
not hold and Fortnox does. That points at **pull**, not push — but see the next
section, because it genuinely could go either way.

## 2. Direction — pull, push, or both

Three different projects. Somebody has to pick before any code.

**A. Pull: Fortnox → portal.** We read invoices, costs or account balances and
show them here next to orders and sales. Gives Tobias one screen. Needs read
access to the relevant endpoints, a sync schedule and somewhere to cache.
*Watch out:* see the read/write problem in section 4.

**B. Push: portal → Fortnox.** A submitted order becomes a purchase order or a
supplier invoice draft in Fortnox, so it is not typed twice. Saves the typing
rather than giving a view. Needs write access, an idempotency key so a retry
does not double-book, and a decision about what happens when a push fails.

**C. Neither — export.** A file Tobias imports himself, or just the figures on
a page in this portal with no Fortnox at all. **This is the option to rule out
first**, because if it is enough it costs a day instead of a quarter, and
there is no OAuth, no token to keep alive and no API to break.

| Question | Why it matters |
| --- | --- |
| Which direction, A, B or C? | Decides whether we need read scopes, write scopes, or no Fortnox at all. |
| If B: what is the source document — a purchase order, a supplier invoice draft, a journal entry? | Three different endpoints and three different approval flows at his end. |
| If A: is a nightly refresh enough, or does he need it live? | Nightly is a script. Live is a webhook and a queue we do not have. |

## 3. Getting in

Fortnox changed its authentication model, so anything written before 2025 is
wrong. **Verify all of this against the official pages** — the links are at
the bottom — but as of the last check:

- It is **OAuth 2.0 authorization code flow**. The old fixed `Access-Token` +
  `Client-Secret` header was deprecated on **30 April 2025** and no longer works.
- You register the integration in the Fortnox Developer Portal and get a
  **Client ID and Client Secret**, a redirect URI and a set of scopes.
- The authorization code is short-lived (minutes). The **access token lasts
  about an hour** and the **refresh token about 45 days**.

That last line is the one with teeth, and it is an operational commitment
rather than a coding problem:

> A refresh token that expires in 45 days means the integration **dies if
> nobody uses it for 45 days**, and reconnecting needs a human to click through
> the Fortnox consent screen again. Whatever we build has to refresh on a
> schedule, store the new refresh token durably, and tell somebody when it
> fails — and this app has no job runner and no alerting today.

| Question | Why it matters |
| --- | --- |
| Who owns the Fortnox account, and who can authorise an integration? | Somebody with admin rights has to approve it. Probably Tobias; confirm. |
| Is there a **test company** we can develop against? | Otherwise the first real request is against live books. |
| Who registers the integration and holds the Client Secret? | It goes in `.env.local`, never the repo. |
| Is the Developer Portal module already enabled on the account? | Existing subscribers may need a support ticket to get it. |
| Does any **licence** have to be bought on top of the scopes? | Holding a scope is not the same as holding the licence it needs. Fortnox publishes a scope-to-licence table; check it before promising a date. |

## 4. Scopes — and the read/write problem

**Read this one carefully.** As far as we can tell from Fortnox's own scopes
documentation:

> A scope grants **read and write** access to its endpoints. There is no
> read-only scope.

If that is still true, then an integration that only wants to *look at*
supplier invoices must be granted the right to *create and change* them. For a
request whose whole purpose is **oversight**, that is a much bigger permission
than the job needs, and it is worth a conversation with Tobias before anybody
clicks approve.

It also changes how the code must be written: with write access granted but not
wanted, the restraint has to be ours. A client that can only issue `GET`, and a
review that enforces it, rather than "we just never call the write endpoints".

| Question | Why it matters |
| --- | --- |
| Confirm: is read-only genuinely impossible? | If it is, option C in section 2 gets considerably more attractive. |
| Exactly which scopes does the chosen direction need? | Ask for the minimum. Each one is a permission somebody has to live with. |
| Who reviews what we ask for? | Granting an integration write access to the books is not a developer's decision. |

## 5. Rate limits and operations

As of the last check, and worth re-confirming:

- **300 requests per minute**, as a sliding window of roughly 25 per 5 seconds.
- Counted **per client id and tenant**, against the access token rather than the IP.
- Over the limit returns **HTTP 429**.

| Question | Why it matters |
| --- | --- |
| How many rows are we talking about per month? | Decides whether a backfill fits inside the limit or needs paging over hours. |
| Does the endpoint we need support **pagination and a modified-since filter**? | Without one, every sync is a full re-read. |
| Is there a sandbox with realistic volume? | A limit you only meet in production is a limit you meet on the worst day. |
| Who gets told when the token expires or a sync fails? | There is no alerting in this app. Somebody has to notice, and "somebody" has to be a name. |

## 6. If we end up reading accounting data

Only relevant for direction A. Each of these changes what a figure means.

| Question | Why it matters |
| --- | --- |
| Are our five stores separate **cost centres**, projects, or nothing at all in Fortnox? | If the books do not separate the shops, a per-store figure cannot be produced however good the API is. This may be the real blocker. |
| Which **accounts** hold the numbers Tobias cares about? | A balance is meaningless without knowing which account it came from. |
| Are amounts **including or excluding VAT**, and which VAT codes apply? | Same trap as the Sharp feed. Snus has its own rules worth checking. |
| How are **suppliers** identified, and can we map them to our `Brand` / `Product.supplier`? | Our supplier is a string on the product. Theirs is a record. Mapping is manual the first time. |
| What is the **accounting period** and when is it closed? | A figure that changes after the fact needs re-pulling, like a restated sales day. |
| Does any of it contain **personal data** — employee names, salaries? | Payroll endpoints do. We have no business storing it, and the scope should not be asked for. |

## 7. What gets built, once this is answered

In this order, and not before:

1. **Token storage and refresh.** A small table holding the refresh token and
   its expiry, a refresh that runs well inside 45 days, and a visible status
   somewhere in `/admin`. This is needed whichever direction wins, and it is
   the piece most likely to be skipped and then to fail silently in week seven.
2. **A client that cannot write**, if the direction is read-only in intent —
   `GET` and nothing else, enforced in one place.
3. **The seam.** The same shape as `SalesProvider` and `ScheduleProvider`: one
   interface, a real implementation and a stub that throws, chosen by one
   environment variable. Everything above it is written against the interface,
   so the integration can be switched off without taking a page with it.
4. **The page**, last. What Tobias actually looks at.

Until step 0 is answered, none of this is written. The placeholders in
`.env.example` are commented out and read by nothing.

---

## Sources

Checked on 2026-11-23. Fortnox's own pages are the authoritative ones; the
third-party guides agree with them but are not a substitute, and the auth model
has changed before.

- [Fortnox — authorize your integration](https://fortnox.se/developer/authorization)
- [Fortnox — scopes](https://www.fortnox.se/developer/guides-and-good-to-know/scopes)
- [Fortnox — rate limits](https://fortnox.se/developer/guides-and-good-to-know/rate-limits-for-fortnox-api)
- [Fortnox — developer integration checklist](https://www.fortnox.se/developer/checklist)
- [Fortnox — OpenAPI specification](https://api.fortnox.se/apidocs)
- [Apideck — how to integrate with the Fortnox API](https://www.apideck.com/blog/how-to-integrate-with-the-fortnox-api)
