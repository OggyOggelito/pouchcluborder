# Sharp API — what we need before anyone writes the integration

We do not have a specification. `SharpSalesProvider` is a stub that throws, and
it will stay one until the questions below are answered, because a guessed
endpoint produces code that looks finished and is wrong in a way nobody
notices until the numbers are in front of a supplier.

Take this list to the statistics lead. Every answer changes code.

---

## 1. Getting in

| Question | Why it matters |
| --- | --- |
| Base URL for **production**, and for a test environment if one exists | We were burned once already: the TooEasy Swagger we were given was on a path containing `Demo`, and that integration is still dormant because nobody could tell us whether it mirrored production. |
| Authentication: API key, OAuth client credentials, basic auth, mTLS? | Decides whether credentials are env vars or a token flow with refresh. |
| Where do credentials come from, and who owns them? | They go in `.env.local`, never in the repo. |
| Rate limits — requests per minute, per day, burst? | Decides whether we poll nightly or page through a backfill. |
| Does it have a sandbox with fake data? | Without one, the first real test is against live takings. |

## 2. The shape of a sales row

This is the question that decides everything downstream.

| Question | Why it matters |
| --- | --- |
| **Is a row a receipt line, or a day's total per product?** | We store daily totals per store and product and want nothing finer. If Sharp returns receipt lines, we aggregate on the way in and **discard** the rest — it must not be written down. |
| Does a row carry a **time of day**? | We drop it. Worth knowing so the aggregation is written to expect it. |
| Does a row carry a **till, operator or cashier id**? | We drop it, and this needs saying out loud: it is personal data about an employee and has no place in a supplier's statistics. |
| Does a row carry anything about the **customer** — a loyalty number, a card token, an age check? | Same answer, and a much louder one. If the feed contains it, the integration must strip it at the boundary and we need to say so in writing. |
| Is the product identified by **EAN**, by an internal article number, by both? | We match on EAN first, then SKU. If Sharp uses neither, we need a mapping table and the unmatched queue becomes the main workflow rather than an exception. |
| Is the **store** identified by a number, a name, or a GUID? | `Store` already carries `tooEasyStoreNumber`; a Sharp identifier probably wants a column of its own. |

## 3. What the numbers mean

| Question | Why it matters |
| --- | --- |
| Are amounts **including or excluding VAT**? | A supplier reading "försäljning" will assume one of them. We currently label the figure "Försäljning" and store whatever the source gives — which is only honest once we know which it is. |
| Are **returns and refunds** included, as negative rows or not at all? | Our importer keeps a negative quantity rather than netting it out, so a return is visible. If Sharp nets them silently, the figures are already adjusted and the label should say so. |
| Are **discounts and campaigns** reflected in the amount, and are they visible as a separate field? | A supplier asking "why is the average price down" needs this. |
| **Cancelled or voided transactions** — excluded, or present with a flag? | A void that arrives as an ordinary row would double the day. |
| Is **gift card or staff purchase** treated as a sale? | Edge case, but it changes a figure a supplier may compare against their own. |
| Currency — always SEK? | Assumed today. |

## 4. Time

| Question | Why it matters |
| --- | --- |
| Which **timezone** are dates in, and are they instants or dates? | We store `"2026-11-04"` as a local Swedish date, deliberately. A UTC instant from a shop open until 20:00 is the same day; one from a 23:30 closing is not. |
| When does a shop's **trading day** end — midnight, or at cash-up? | A late sale after midnight belongs to the previous trading day in most till systems. If Sharp disagrees with us, every day boundary is off. |
| **History depth** — how far back can we pull? | Decides whether we can show a year-on-year comparison or only what we have collected since switching on. |
| **Update frequency** — real time, hourly, nightly batch? | Decides what the page should say about freshness. It currently says "kan släpa någon dag". |
| Is a day ever **restated** after the fact? | Our importer replaces a day rather than adding to it, which handles restatement correctly — but only if we know to re-pull. |

## 5. Operational

| Question | Why it matters |
| --- | --- |
| Who do we contact when the feed stops? | There is no alerting in this app; somebody has to notice. |
| Is there a changelog or version for the API? | So a silent field rename does not become a silent wrong number. |
| What does Sharp consider our **data processing** relationship to be? | See the privacy note in `docs/supplier-portal.md`: if the feed carries anything about employees or customers, the agreement matters before the first request. |

---

## What happens once this is answered

1. `SharpSalesProvider.pull()` is implemented against the real endpoints, returning
   `SalesLine[]` — the same type the CSV parser already produces.
2. Anything finer than a daily total per store and product is aggregated and dropped
   **inside** that method. Nothing else in the app ever sees it.
3. A scheduled pull replaces `/admin/stats`' upload as the normal path; the upload stays,
   because a feed that is down is not a reason to have no figures.
4. `SALES_PROVIDER=sharp` switches it on. Everything downstream — storage, the brand
   scoping, the pages, the export — is already running against real imports and does not
   change.
