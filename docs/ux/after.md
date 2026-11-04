# After — what changed, measured the same way

Companion to [`audit.md`](./audit.md). Same device (390×844), same definition
of a tap: one pointer interaction, with typing counted as part of the tap that
focuses the field. Counting starts at the app's cold-start screen, which is now
`/` for every role.

Screenshots: [`docs/ux/after/`](./after/) beside [`before/`](./before/).

---

## 1. Tap counts

| # | Task | Role | Before | After | Path now |
| --- | --- | --- | ---: | ---: | --- |
| 1 | Place an order for 3 products from scratch | OWNER | 7 | **9** | Ny beställning ▸ sök ▸ `+` ▸ rensa ▸ `+` ▸ rensa ▸ `+` ▸ Granska ▸ Skicka |
| 2 | Repeat the last order | OWNER | **N/A** | **3** | Mer ▸ Tidigare beställningar ▸ Beställ samma igen *(+2 to review and send)* |
| 3 | Receive a delivery | OWNER | N/A | **N/A** | No goods-receiving feature exists |
| 4 | Find a flavour for a customer | any | 3 | **2** | 🔍 ▸ träff |
| 5 | Read a brand page | any | 3 | **2** | 🔍 ▸ träff, or Guide ▸ kort |
| 6 | See my shifts next week | STAFF | 4 *(after escaping a 404)* | **1–2** | "Hela schemat" on Idag when working today, otherwise Mer ▸ Mitt schema |
| 7 | Read the latest news | any | 2 | **1** | Nyheter in the bottom bar |
| 8 | Check the import review queue | ADMIN | 2, to a number that linked nowhere | **1** | Idag ▸ "N produkter att granska" |
| 8b | Confirm waiting orders | ADMIN | N/A | **N/A** | `Order` has no status; there is nothing to confirm |

**Target met** — every task within three taps of the home screen, with the two
documented exceptions: ordering from scratch (excluded by the brief) and the
two tasks whose features do not exist.

### Task 1 got longer, deliberately

Ordering from scratch went from 7 taps to 9. Both extra taps were asked for:

- **+1** because the order form is no longer the app's front door. `/` is now
  "Idag", and for a STAFF member — most of the staff — the old front door was
  a 404.
- **+1** for the "Granska" screen between picking and sending.

Everything around it got shorter. **Repeating an order is the common case for
a restock**, and it went from "read the old order and retype every line" to
three taps.

---

## 2. Accessibility

axe-core, WCAG 2.0/2.1 A and AA, 15 screens across three roles
(`npm run ux:axe`):

| | Before | After |
| --- | ---: | ---: |
| Serious/critical violations | 8 | **0** |
| Failing nodes | ~2320 | **0** |
| Lighthouse accessibility score | 89–90 | **100** |

Everything that failed was contrast: `text-zinc-400` (≈2.6:1 on white) as the
house colour for secondary text, plus white on `brand-600` in buttons and
badges (≈3.8:1). Secondary text is now `zinc-500` and the brand surfaces are
`brand-700`; both clear 4.5:1.

Tap targets, same three roles over 13 screens (`npm run ux:targets`):

| | Before | After |
| --- | ---: | ---: |
| Interactive elements under 44×44 | every page; **1131** on the finder alone | **0** |
| Pages scrolling sideways at 390px | 0 | **0** |

The probe measures the label row for a checkbox or radio wrapped in one, and
skips links sitting inside a paragraph — those are text, and padding them to
44px would break the sentences they live in.

Also added: a skip link, a visible focus ring that survives dark buttons, and
`maximumScale` removed from the viewport so the page can be pinched to zoom.

---

## 3. Performance

Lighthouse, mobile form factor, against a **production build**
(`next build && next start`), authenticated. Repeated runs where the number
moved, because Lighthouse varies a couple of points between runs.

| Screen | Before | After | LCP | TBT | Transfer |
| --- | ---: | ---: | ---: | ---: | ---: |
| `/` | 97 | **97–98** | 2.4–2.7 s | 60 ms | 166 KiB |
| `/order` *(was `/`)* | 97 | **95** | 2.7 s | 110 ms | 200 KiB |
| `/staff` | 97 | **95** | 2.8 s | 120 ms | 179 KiB |
| `/staff/finder` | 96 | **91–93** | 2.8 s | 210–240 ms | 214 KiB |

**The finder lost about four points and that is a real regression**, not
noise — three runs landed on 91, 92 and 93. The cause is the app shell:
every page now mounts a bottom bar, a sidebar and the search dialog, which is
roughly 12 KiB and some blocking time that the finder previously did not pay.
It buys the navigation the whole task is about, and 91 is still comfortably in
Lighthouse's green band, so it stands.

**The catalog was never the problem.** The order page inlines all 1088 active
products — 327 KB of HTML — and scores 95 with 110 ms of blocking time. The
same page under `next dev` scores **54**, which is what made it look urgent.
Virtualising the list was in the brief and was **not** done; see "What was not
changed" below.

---

## 4. One thing that regressed: the status code on a refused route

The app refuses a route the account may not open by calling `notFound()`, and
that used to produce an HTTP **404**. It now produces a **200** carrying the
404 page.

The cause is the app shell. The root layout is now async — it resolves the
session, the feature flags and the unread count to render the navigation — so
every response is streamed, and the Next docs are explicit about what that
means:

> Next.js will return a `200` HTTP status code for streamed responses, and
> `404` for non-streamed responses.

Confirmed by removing `not-found.tsx` and re-measuring: still 200, so it is
the streaming and not the custom page.

**Authorization is unaffected**, and that is worth stating precisely. The
guard still runs before anything else, the page body never renders, and no
privileged data is fetched or sent. Verified by content rather than status:

| Role | `/admin` | `/admin/review` | `/admin/users` | `/order` | `/orders` |
| --- | --- | --- | --- | --- | --- |
| STAFF | refused | refused | refused | refused | refused |
| OWNER | refused | refused | refused | renders | renders |
| ADMIN | renders | renders | renders | store picker | renders |

The fix would be to move role checks into `proxy.ts` so a refusal never
reaches the renderer — which would mean trusting the role in the JWT. This app
deliberately reads the user through to the database on every request so that
removing someone's store access takes effect immediately, and that is worth
more than a status code. Left as it is, on purpose.

---

## 5. What was not changed, and why

- **Virtualising the catalog.** The brief asks for it; production measurements
  say the 1088-product order page scores 95 with 110 ms of blocking time. The
  change would add real complexity to the most-used screen for no measured
  gain. The 54 that made it look urgent was `next dev`.
- **Goods receiving, delivery discrepancies, order confirmation, catalog
  previews, push settings.** None of these features exist. The cards and
  counts that would have shown them are left out rather than faked; `push` is
  a flag that stays false until VAPID keys exist.
- **Hiding money from store staff.** The order total uses `pricePerStock`,
  which is `Inpris` × `unitsPerStock` — the store's **cost**, not the shelf
  price. It is now labelled "inköpsvärde" instead of appearing as a bare kr
  figure, but whether staff should see it at all is a business decision.

---

## 6. Verification commands

```bash
npm run ux:shots -- after   # screenshots at 390x844, all three roles
npm run ux:axe              # axe-core; --json for the failing selectors
npm run ux:targets          # tap targets under 44px and sideways scroll
npm test                    # 187 tests
```

All three browser scripts need the dev server running and use the Chrome
already installed on the machine rather than downloading Playwright's own
build.
