# UX audit — Pouch Club portal

Taken on **2026-11-04**, against commit `902c190`, before any change in this
task. Everything below is measured, not estimated: routes come from the
filesystem and the guard each page calls, tap counts from walking the app at
390×844, contrast and tap-target numbers from axe-core and a DOM probe,
Lighthouse from a production build.

Screenshots of the state described here: [`docs/ux/before/`](./before/).

---

## 0. Things the brief assumes that do not exist

Worth stating first, because four of the eight tap-count tasks and several of
the planned "Idag" cards depend on them.

| Assumed | Reality |
| --- | --- |
| Goods receiving / deliveries | **No such feature.** No model, no route, no UI. |
| Delivery discrepancies | Nothing. The nearest thing is a `DELIVERY` problem report. |
| Purchasing module | Nothing beyond the restock order form. |
| "Orders to confirm" | `Order` has **no status column**. An order is submitted and that is the end of it. |
| Catalog import previews waiting | The importer applies directly; there is no preview queue. |
| Push notifications / VAPID | Nothing. Notifications are in-app rows only. |
| `OrderDraft` | Does not exist. Order state lives in React state and is lost on reload. |
| Feature flags | No mechanism of any kind. |
| Global search | Does not exist. `searchableFor()` in the nav config has no consumer. |

Consequence: tasks 2, 3 and half of 8 in the tap table below cannot be
performed at all, and the "deliveries waiting" and "orders to confirm" cards
have no data source. They are recorded as **N/A — feature absent** rather than
given a number.

---

## 1. Route inventory

44 page routes and 7 API routes. "Linked from" counts the places a user can
actually reach it by tapping; `src/config/navigation.ts` drives the header menu
(`NAV_ENTRIES`) and the admin hub (`ADMIN_ENTRIES`).

### Public (no sign-in)

| Route | Roles | Linked from | Task it serves |
| --- | --- | --- | --- |
| `/login` | anyone | header (signed out), every redirect | Sign in |
| `/staff` | anyone | header menu | Brand guide landing |
| `/staff/finder` | anyone | header menu, `/staff` | Find a product for a customer |
| `/staff/brands/[slug]` | anyone | `/staff`, finder results | Read a brand page |

### Signed in

| Route | Roles | Linked from | Task it serves |
| --- | --- | --- | --- |
| `/` | OWNER, ADMIN | **nav config: no** — only `/orders` and the order confirmation | Place a restock order |
| `/orders` | OWNER, ADMIN | header menu | Past orders, Excel re-export |
| `/news` | all | header menu, `/staff` widget | Read news |
| `/my-schedule` | all | header menu | My shifts, 14 days |
| `/team-schedule` | OWNER, ADMIN | header menu | Who is working in the region |
| `/my-onboarding` | all | header menu | My onboarding checklist |
| `/notifications` | all | header menu | In-app notifications |
| `/staff/checklists` | all | header menu | Opening / closing checklists |
| `/staff/quizzes`, `/staff/quizzes/[id]` | all | header menu | Self-test |
| `/staff/routines`, `/staff/routines/[slug]` | all | header menu, `/staff` card | How do we do X |
| `/store/notes` | all | header menu, `/staff` card, `/store/issues` | Shift handover |
| `/store/issues`, `/store/issues/new`, `/store/issues/[id]` | all | header menu, `/staff` card, `/store/notes` | Report a problem |
| `/requests/new` | all | header menu, `/staff` card, finder no-results | Log a customer request |
| `/transfers`, `/transfers/[id]` | all | header menu, `/staff` card | Store-to-store transfers |
| `/transfers/new` | OWNER, ADMIN | `/transfers` | Ask another store for stock |
| `/transfers/[id]/print` | all | transfer detail | Följesedel |

### Admin

`/admin` plus twelve sub-pages, all `requireAdmin()`, all linked from the
`/admin` hub: `requests`, `transfers`, `issues`, `routines`, `brands`,
`checklists`, `quizzes`, `flavor-tags`, `users`, `schedule`, `announcements`,
`tooeasy`. Three deeper pages — `/admin/checklists/today`,
`/admin/quizzes/results`, and the various `[id]` editors — are linked only from
their parent.

### 🚩 Flags

1. **`/` is not in the navigation config.** The most-used screen in the app —
   the order form — has no menu entry. Once an OWNER navigates away, the only
   routes back are the "Till beställningen" link at the bottom of `/orders`
   and the logo. This is the single worst navigation defect.
2. **STAFF opening the app gets a 404.** `/` calls `requireOrderingUser()`,
   which 404s for STAFF. There is no role-aware landing page, so the default
   experience for the largest group of users is Next's untranslated *"This page
   could not be found."* See [`before/staff-home.png`](./before/staff-home.png).
3. **The needs-review count is a dead end.** `/admin` prints "N behöver
   granskas" as plain text. No route lists those products, so the number cannot
   be acted on.
4. **Two entry points, two destinations, one feature.** The `/staff` quick-action
   cards link to `/store/issues/new` and `/staff/routines`, while the header
   links to `/store/issues` and `/staff/routines`. Same features, different
   landing points depending on where you tapped.
5. **Thirteen menu items, one flat list.** Everything a signed-in user can
   reach is in one `<details>` menu with no grouping beyond a small heading, and
   no way to tell where you currently are — there is no active state anywhere.
6. **No `loading.tsx`, `error.tsx` or `not-found.tsx` exist** anywhere in
   `src/app`. Every slow page is a blank screen and every failure is the
   framework default, in English.

---

## 2. Tap counts (390×844, current state)

A *tap* is one pointer interaction. Typing is counted as part of the tap that
focuses the field. Counting starts at the app's cold-start screen for that
role: `/` for OWNER and ADMIN, `/` → 404 for STAFF.

| # | Task | Role | Taps | Path |
| --- | --- | --- | --- | --- |
| 1 | Place an order for 3 products from scratch | OWNER | **7** | search ▸ `+` ▸ clear ▸ `+` ▸ clear ▸ `+` ▸ Skicka |
| 2 | Repeat the last order | OWNER | **N/A** | No repeat exists. The only way is to open `/orders`, read the old order, and re-enter every line by hand. |
| 3 | Receive a delivery | OWNER | **N/A** | Feature absent. |
| 4 | Find a flavour for a customer | any | **3** | Meny ▸ Produktsök ▸ search field |
| 5 | Read a brand page | any | **3** | Meny ▸ Guide ▸ brand card |
| 6 | See my shifts next week | STAFF | **4** | *(escape the 404)* Meny ▸ Guide ▸ Meny ▸ Schema |
| 7 | Read the latest news | any | **2** | Meny ▸ Nyheter |
| 8 | Confirm waiting orders **and** check the import review queue | ADMIN | **partly N/A** | Confirming: no such flow. Review queue: Meny ▸ Admin = **2** taps to see a count that links nowhere. |

Task 6 is the clearest illustration of the 404 problem: a STAFF member's own
schedule is two taps away from a page they cannot reach, so in practice it is
four taps and requires knowing that "Guide" is the way out of a dead end.

---

## 3. Problem list

### Terminology

`stock`, `stockar`, `dosa`, `dosor` and `antal` are all in use with no shared
definition and nowhere that explains them:

| Word | Where | Means |
| --- | --- | --- |
| `stock` / `stockar` | order form, summary bar, order list, Excel export, transfers | A package of several cans — the unit the store orders in |
| `dosa` | transfer units | One can |
| `antal` | admin requests, transfer builder, följesedel, supplier import | Quantity, of whichever unit that screen happens to use |

Nothing on the order screen tells a new employee what a *stock* is. The word
appears first in `0 stockar` in the summary bar, with no explanation.

### More than one primary action per screen

- `/staff`: four quick-action cards, a notes card, a news widget and a brand
  directory, with no single thing the page is for.
- `/admin`: a sub-page grid, two import widgets and a brand list, all equally
  weighted.
- Transfer detail: accept, decline, cancel and print all look alike.

### Breaks at 390px

No horizontal scroll was found on any page, which is better than expected. The
problems are touch and contrast, not layout:

| Issue | Measured |
| --- | --- |
| Targets under 44×44 | Every page. Menu items are 230×**36**, "Meny" is 59×**40**, filter chips and tabs are **40** high, the logo is **32×32**, the admin publish checkbox is **13×13**. `/staff/finder` has **1131** undersized targets. |
| Contrast below AA | **2320 nodes** across 11 screens, essentially all of it `text-zinc-400` (≈2.6:1 on white). `/staff/finder` alone accounts for 2180. |
| Other axe serious/critical | **None.** No missing labels, no heading-order breaks, no ARIA errors. |

The quantity stepper is the exception and is already right: 44×44 − / + with a
typable field.

### Missing states

- **No loading state anywhere.** No `loading.tsx` exists, and no page renders a
  skeleton. Every slow page is a blank white screen, which on a stockroom
  connection is indistinguishable from a broken one.
- **No error boundary anywhere.** No `error.tsx` and no `not-found.tsx` exist,
  so a failed query falls through to the framework's own screen — in English,
  with no way back.
- **One page gets this right and the rest should copy it.** `/my-schedule`
  already separates "the provider is unreachable" from "you have no shifts",
  and says in so many words that an outage does not mean you are off work.
  That is the model; nothing else distinguishes the two cases, because
  nothing else has an error path at all — they simply throw.
- Empty states that *do* exist are inconsistent: some are dashed-border cards,
  some are a grey sentence, some are nothing at all.

### Dead ends

- STAFF at `/` — a 404 with only the logo and "Meny" to escape.
- `/admin`'s needs-review count links nowhere.
- `/transfers/[id]/print` has no link back to the transfer.
- The order confirmation's "Tidigare beställningar" leaves the order flow with
  no way back to the order just placed.

### Performance

Measured against a **production build** (`next build && next start`), mobile
form factor, simulated throttling:

| Screen | Perf | A11y | Best practices | LCP | TBT | Transfer |
| --- | --- | --- | --- | --- | --- | --- |
| `/` (order form, OWNER) | 97 | 90 | 96 | 2.3 s | 130 ms | 184 KiB |
| `/staff` | 97 | 90 | 96 | 2.5 s | 70 ms | 172 KiB |
| `/staff/finder` | 96 | 89 | 96 | 2.4 s | 150 ms | 202 KiB |

**The catalog is not a performance problem in production.** The order page
inlines all 1088 active products — 327 KB of HTML — and still scores 97 with
130 ms of blocking time, because it is one flat list of mostly-collapsed
brands. The same page served by `next dev` scores **54** with 990 ms TBT, which
is a dev-server artefact and not what anyone experiences.

The accessibility score of 89–90 is the contrast issue above, and is the only
number here worth moving.

---

## 4. What the audit implies for the rest of this task

Ranked by how much harm the problem does now:

1. A role-aware home at `/`, because STAFF currently land on a 404.
2. `/` registered in navigation, because the order form is unreachable from the
   menu.
3. Grouped navigation with an active state and 44 px targets.
4. `text-zinc-400` → a passing shade, which clears ~2320 contrast failures.
5. Loading and error states, so a slow page stops looking broken and a failed
   one stops looking English.
6. A glossary for *stock* / *dosa* / *antal*.
7. Order drafts, because an interrupted order is currently lost entirely.

And what the audit says **not** to do: virtualising the catalog. The brief
asks for it on the assumption that 1,100 products are slow; production
measurements say otherwise, and the change would add real complexity to the
most-used screen in the app for no measured gain.
