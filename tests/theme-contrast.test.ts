import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { contrastRatio, ratio } from "../src/lib/contrast";
import { SURFACES, TOKENS, type TokenName } from "../src/styles/tokens";

/** WCAG AA for normal text. */
const TEXT_MIN = 4.5;
/** WCAG AA for the boundary of a user interface component. */
const CONTROL_MIN = 3;

/** Everything that renders as text on a surface. */
const TEXT_TOKENS: TokenName[] = [
  "text",
  "text-muted",
  "danger",
  "success",
  "info",
  "warning",
  "primary",
];

describe("the token file is the only source of truth", () => {
  it("agrees with src/styles/tokens.css", () => {
    const css = readFileSync(path.join(process.cwd(), "src", "styles", "tokens.css"), "utf8");

    for (const [name, value] of Object.entries(TOKENS)) {
      const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8});`));
      assert.ok(match, `--${name} is missing from tokens.css`);
      assert.equal(
        match[1].toLowerCase(),
        value.toLowerCase(),
        `--${name} differs between tokens.css and tokens.ts`
      );
    }
  });
});

describe("text contrast on every surface", () => {
  for (const surface of SURFACES) {
    for (const token of TEXT_TOKENS) {
      it(`${token} on ${surface} clears ${TEXT_MIN}:1`, () => {
        const value = contrastRatio(TOKENS[token], TOKENS[surface]);
        assert.ok(
          value >= TEXT_MIN,
          `${token} on ${surface} is ${ratio(TOKENS[token], TOKENS[surface])}:1, needs ${TEXT_MIN}:1`
        );
      });
    }
  }

  it("holds the measured figures the brief quotes", () => {
    assert.ok(ratio(TOKENS.text, TOKENS.bg) >= 11.3);
    assert.ok(ratio(TOKENS.text, TOKENS.surface) >= 9.7);
    assert.ok(ratio(TOKENS.text, TOKENS["surface-raised"]) >= 7.9);
  });

  it("keeps muted text readable, not decorative", () => {
    for (const surface of SURFACES) {
      assert.ok(
        ratio(TOKENS["text-muted"], TOKENS[surface]) >= 6.3,
        `text-muted on ${surface} is ${ratio(TOKENS["text-muted"], TOKENS[surface])}:1`
      );
    }
  });
});

describe("control borders", () => {
  for (const surface of SURFACES) {
    it(`border-control is visible on ${surface}`, () => {
      const value = contrastRatio(TOKENS["border-control"], TOKENS[surface]);
      assert.ok(
        value >= CONTROL_MIN,
        `border-control on ${surface} is ${ratio(TOKENS["border-control"], TOKENS[surface])}:1, needs ${CONTROL_MIN}:1`
      );
    });
  }
});

describe("the primary button", () => {
  it("reads navy on yellow, and keeps reading through hover and pressed", () => {
    for (const fill of ["primary", "primary-hover", "primary-pressed"] as const) {
      const value = contrastRatio(TOKENS["on-primary"], TOKENS[fill]);
      assert.ok(
        value >= TEXT_MIN,
        `on-primary on ${fill} is ${ratio(TOKENS["on-primary"], TOKENS[fill])}:1`
      );
    }
  });

  it("is distinguishable from the page it sits on", () => {
    assert.ok(contrastRatio(TOKENS.primary, TOKENS.bg) >= CONTROL_MIN);
    assert.ok(contrastRatio(TOKENS.primary, TOKENS.surface) >= CONTROL_MIN);
  });
});

describe("status colours are not the brand colour", () => {
  it("keeps warning orange, away from the yellow", () => {
    // A yellow warning is indistinguishable from ordinary body text here.
    assert.notEqual(TOKENS.warning.toLowerCase(), TOKENS.primary.toLowerCase());
    assert.ok(
      contrastRatio(TOKENS.warning, TOKENS.primary) >= 1.3,
      "warning and primary are too close to tell apart"
    );
  });

  it("gives every status its own hue", () => {
    const statuses = ["danger", "success", "info", "warning"] as const;
    const values = statuses.map((name) => TOKENS[name].toLowerCase());
    assert.equal(new Set(values).size, statuses.length);
  });
});
