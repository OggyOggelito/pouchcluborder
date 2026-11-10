# Brand assets

## `logo.svg` — not supplied yet

Drop the real Pouch Club logo here as `logo.svg` and the header picks it up on
the next server start. Nothing else needs changing: `src/components/nav/Wordmark.tsx`
checks for this exact path and falls back to the words "Pouch Club" until it
exists.

It is rendered at `h-8` (32 px tall) with the width left to the file's own
aspect ratio, on the navy `--surface` header. A single-colour mark in
`--text` (#f8c50b) will sit correctly; anything with its own background will
look like a sticker.

## Still to supply

| Asset | Where | Now |
| --- | --- | --- |
| Logo | `public/brand/logo.svg` | missing — header shows a text wordmark |
| App icon | `src/app/icon.svg` | **placeholder**: navy tile, initials in yellow |
| Apple touch icon | `src/app/apple-icon.png` (180×180) | missing — iOS renders a screenshot instead |

There is no web manifest and no service worker, so the app is not installable
as a PWA. If you want it to be, that is a separate piece of work — say so and
it can be added along with the icon set.
