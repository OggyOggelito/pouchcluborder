/**
 * Fails the build if a colour is written anywhere but the token files.
 *
 * The theme only stays one theme if there is exactly one place to change it.
 * This catches the three ways a colour sneaks back in: a hex literal, a
 * functional notation like rgb() or oklch(), and a Tailwind palette class such
 * as `bg-white` or `text-zinc-500`.
 *
 *   npm run lint:colors
 *
 * Exceptions are listed in ALLOWED below, each with a reason. Add to it only
 * when the colour genuinely cannot live in a token — not to silence a hit.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "node:fs";

/** Files that may contain raw colour values, and why. */
const ALLOWED: { path: string; reason: string }[] = [
  { path: "src/styles/tokens.css", reason: "the tokens themselves" },
  {
    path: "src/styles/tokens.ts",
    reason: "literals for <meta name=\"theme-color\">; kept in step by tests/theme-contrast.test.ts",
  },
  {
    path: "src/app/icon.svg",
    reason: "a static asset cannot read a CSS variable; placeholder, see public/brand/README.md",
  },
  {
    path: "src/lib/contrast.ts",
    reason: "parses hex strings; the examples in its doc comment are not colours in use",
  },
];

const HEX = /#[0-9a-fA-F]{3,8}\b/;
const FUNCTIONAL = /\b(rgb|rgba|hsl|hsla|oklch|lab|lch|color-mix)\(/;
const PALETTE = new RegExp(
  "\\b(bg|text|border|ring|from|to|via|fill|stroke|decoration|outline|divide|placeholder|accent|shadow|caret)-" +
    "(white|black|zinc|gray|grey|slate|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|" +
    "blue|indigo|violet|purple|fuchsia|pink|rose)" +
    "(-(50|100|200|300|400|500|600|700|800|900|950))?\\b"
);

type Finding = { file: string; line: number; text: string; rule: string };

function filesToCheck(): string[] {
  return globSync("src/**/*.{ts,tsx,css,svg}", { cwd: process.cwd() })
    .filter((file) => !file.includes(`${path.sep}generated${path.sep}`))
    .filter((file) => !file.split(path.sep).includes("generated"))
    .sort();
}

function main() {
  const allowed = new Set(ALLOWED.map((entry) => entry.path));
  const findings: Finding[] = [];

  for (const file of filesToCheck()) {
    const normalized = file.split(path.sep).join("/");
    if (allowed.has(normalized)) continue;

    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, index) => {
      // A line may opt out with a reason on the same line.
      if (line.includes("lint-colors-allow")) return;

      for (const [rule, pattern] of [
        ["hex literal", HEX],
        ["rgb()/hsl()/oklch()", FUNCTIONAL],
        ["Tailwind palette class", PALETTE],
      ] as const) {
        if (pattern.test(line)) {
          findings.push({ file: normalized, line: index + 1, text: line.trim().slice(0, 100), rule });
          break;
        }
      }
    });
  }

  if (findings.length === 0) {
    console.log(`No raw colours outside the token files. Checked ${filesToCheck().length} files.`);
    console.log("\nAllowed, by design:");
    for (const entry of ALLOWED) console.log(`  ${entry.path} — ${entry.reason}`);
    return;
  }

  console.error(`${findings.length} raw colour(s) outside src/styles/tokens.css:\n`);
  for (const finding of findings) {
    console.error(`  ${finding.file}:${finding.line}  [${finding.rule}]`);
    console.error(`    ${finding.text}`);
  }
  console.error("\nUse a token instead — see src/styles/tokens.css.");
  console.error("If it genuinely cannot be a token, add the file to ALLOWED in this script");
  console.error("with a reason, or put `lint-colors-allow` on the line.");
  process.exitCode = 1;
}

main();
