# Theme — Pouch Club navy and yellow

The app is dark: navy background, yellow text. There is no light theme and no
toggle. The one exception is print.

Screenshots at 390 px: [`docs/theme/before/`](./theme/before/) and
[`docs/theme/after/`](./theme/after/).

---

## Before

Audited on 2026-11-10 against commit `8bfc7ad`, before any change. The project
is **Tailwind v4**, configured in CSS — there is no `tailwind.config.js`, so
tokens go in an `@theme` block.

| What | Count |
| --- | ---: |
| Tailwind palette classes (`bg-white`, `text-zinc-500`, …) | **1394** |
| Distinct palette classes | 52 |
| Files containing them | 94 |
| Hex literals outside CSS | 2 |
| `rgb()` / `oklch()` | 8, all in `globals.css` |
| Inline `style=` carrying a colour | 0 — the two inline styles set a width |

The ten most common, which is most of the work:

| Class | Uses | Became |
| --- | ---: | --- |
| `text-zinc-500` | 241 | `text-muted` |
| `border-zinc-200` | 186 | `border-line` |
| `text-zinc-600` | 140 | `text-muted` |
| `bg-white` | 111 | `bg-surface` |
| `text-white` | 83 | `text-on-primary` |
| `bg-zinc-900` | 73 | `bg-primary` |
| `text-zinc-700` | 70 | `text-ink` |
| `border-zinc-300` | 67 | `border-control` |
| `bg-zinc-100` | 42 | `bg-raised` |
| `border-zinc-400` | 31 | `border-control` |

The two hex literals were `themeColor: "#18181b"` in `layout.tsx` and
`background: #fff` in the print block. The `oklch()` values were the old green
brand ramp, which is gone.

## After

| What | Count |
| --- | ---: |
| Tailwind palette classes | **0** |
| Hex / `rgb()` / `oklch()` outside the token files | **0** |

Enforced by `npm run lint:colors`, which runs as the first step of
`npm run build`. It checks every `.ts`, `.tsx`, `.css` and `.svg` under `src/`.

---

## Tokens

All of them live in [`src/styles/tokens.css`](../src/styles/tokens.css). That
file is the only place in the repo allowed to contain a colour value.

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#02152d` | page background |
| `--surface` | `#0a2442` | cards, panels, header, bottom bar |
| `--surface-raised` | `#12335c` | inputs, hover rows, selected items, skeletons |
| `--text` | `#f8c50b` | headings, body, labels |
| `--text-muted` | `#a9b8cc` | hints, captions, timestamps |
| `--primary` | `#f8c50b` | primary buttons |
| `--on-primary` | `#02152d` | text on primary buttons |
| `--primary-hover` | `#ffd23a` | hover |
| `--primary-pressed` | `#dcaa00` | pressed |
| `--border` | `#2c4a75` | decorative dividers only |
| `--border-control` | `#5b7fae` | inputs, checkboxes, outlined buttons |
| `--focus` | `#f8c50b` | focus ring, 2 px with 2 px offset |
| `--danger` | `#ff7b7b` | errors, destructive actions |
| `--success` | `#5ee08a` | success |
| `--info` | `#7cc7ff` | information |
| `--warning` | `#ff9a3c` | warnings — orange, never yellow |

Three were added. They are explained under "Values I changed" below:
`--scrim`, `--print-bg` / `--print-text` / `--print-border`.

### Tailwind names

`@theme` in `globals.css` maps each token to a class. The names are chosen to
read as English:

`bg-canvas` · `bg-surface` · `bg-raised` · `text-ink` · `text-muted` ·
`bg-primary text-on-primary` · `border-line` · `border-control` ·
`text-danger` · `text-success` · `text-info` · `text-warning` · `bg-scrim`

---

## The rules this theme runs on

Almost all text is one colour, so colour can no longer carry meaning on its
own. Everything below exists because of that.

**Clickability.** Links are underlined. A primary action is filled yellow with
navy text, and *nothing else in the app is filled yellow* except small badges —
so a yellow block always means "press this". Secondary actions are transparent
with a `--border-control` outline and yellow text. Tertiary is text with an
icon.

**Hierarchy** comes from size, weight and spacing. Body copy is `line-height:
1.6`; long-form prose is capped at `65ch` by `.prose-measure`, applied in the
`Markdown` component, so a Swedish paragraph does not run the width of a
desktop layout.

**Status is never colour alone.** `StatusBadge` draws a glyph — `✓ ! ✕ i •` —
and carries a screen-reader label ("Varning:", "Fel:"). Checklist ticks show a
`✓`. Success is green rather than the brand yellow, because yellow already
means "press me".

**Selected and active** states use `--surface-raised` plus a yellow indicator,
never a colour swap: a 3 px bar above the label in the bottom bar, a 3 px bar
down the left edge in the sidebar and the "Mer" sheet, and a yellow ring with
bold text on filter chips and tabs.

**Disabled** is 50 % opacity, `cursor: not-allowed`, and no hover reaction.

**Inputs** are `--surface-raised` with a `--border-control` edge, yellow text
and a `--text-muted` placeholder. Autofill is overridden with an inset shadow,
because Chrome paints its own white box over any styling — the login form is
the first filled input most people meet.

**Focus** is a 2 px `--focus` outline at 2 px offset on every focusable
element. On a filled yellow button a yellow ring would vanish, so there the
outline switches to `--on-primary` and moves inside the button.

**`color-scheme: dark`** is set, so selects, date pickers and scrollbars render
their dark variants instead of coming back white.

**No white flash.** `<html>` carries the navy background, not just `<body>`, so
the page is navy before any stylesheet has painted.

---

## Contrast

Every pair is recomputed from the token values by
[`tests/theme-contrast.test.ts`](../tests/theme-contrast.test.ts), which fails
under 4.5:1 for text and 3:1 for control borders. The test also parses
`tokens.css` and fails if `tokens.ts` has drifted from it.

| | on `--bg` | on `--surface` | on `--surface-raised` |
| --- | ---: | ---: | ---: |
| `--text` | 11.3:1 | 9.7:1 | 7.9:1 |
| `--text-muted` | 9.1:1 | 7.7:1 | 6.3:1 |
| `--danger` | 7.3:1 | 6.2:1 | 5.1:1 |
| `--success` | 10.9:1 | 9.3:1 | 7.6:1 |
| `--info` | 10.0:1 | 8.5:1 | 6.9:1 |
| `--warning` | 8.7:1 | 7.4:1 | 6.0:1 |
| `--border-control` | 4.4:1 | 3.8:1 | 3.1:1 |

Navy on yellow, through all three button states: `--primary` 11.3:1,
`--primary-hover` 12.7:1, `--primary-pressed` 8.5:1.

**Every figure you measured held exactly**: `--text` 11.3 / 9.7 / 7.9,
`--text-muted` never below 6.3, the semantic colours never below 5.0, and
`--border-control` 4.4 against `--bg` and 3.1 against `--surface-raised`. axe-core reports **0 serious or critical
violations** across 15 screens at 390 px, colour-contrast included
(`npm run ux:axe`).

---

## Values I changed

**None of yours.** Every one of the sixteen tokens is the value you supplied.

Three were **added**, because the design needed a colour that was not on the
list:

| Token | Value | Why |
| --- | --- | --- |
| `--scrim` | `rgb(2 21 45 / 0.72)` | The backdrop behind a dialog. The old value was a zinc black at 40 %, which over navy read as a grey smudge. Navy at 72 % keeps the page recognisable underneath while clearly pushing it back. |
| `--print-bg` | `#ffffff` | Print is the one place the app is not dark. Kept as a token so `globals.css` holds no literal. |
| `--print-text` | `#000000` | As above. |
| `--print-border` | `#666666` | Table and card edges on paper. |

---

## Where it is not dark

**Print.** `@media print` forces white background and black text, drops the
header, the nav and anything marked `data-print-hidden`, and clears every
themed background with a blanket rule — so a component added later cannot
print yellow. Verified on the routine page: `rgb(255,255,255)` background,
`rgb(0,0,0)` text, nav hidden. See
[`after/print-routine.png`](./theme/after/print-routine.png).

**Excel exports** are untouched. They are generated by `src/lib/excel.ts` and
contain no styling this task touched.

**Notification emails** do not exist. The notification service is in-app rows
only — no mail transport, no templates. Nothing to theme.

**Supplier brand pages** (Loop, XQS, Helwit …) keep our theme. Nothing is
recoloured to match a supplier, and no supplier logo or image was added.

---

## Exceptions

Four files may contain a raw colour, each listed in `ALLOWED` in
`scripts/lint-colors.ts` with its reason:

| File | Why |
| --- | --- |
| `src/styles/tokens.css` | the tokens themselves |
| `src/styles/tokens.ts` | literals for `<meta name="theme-color">`, which cannot hold a CSS variable; a test fails if it drifts from the CSS |
| `src/app/icon.svg` | a static asset cannot read a CSS variable |
| `src/lib/contrast.ts` | parses hex strings; the hexes in its doc comment are examples, not colours in use |

A single line can also opt out with a `lint-colors-allow` comment. Nothing
currently uses it.

There are **no third-party UI components** in this app — no component library,
no embedded widgets — so there is no vendor CSS to exempt.

---

## Verify

```bash
npm run lint:colors          # fails on a raw colour outside the token files
npm test                     # includes the contrast suite
npm run ux:axe               # axe-core at 390px, three roles
npm run theme:shots -- after # screenshots into docs/theme/after/
```
