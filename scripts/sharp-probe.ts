/**
 * Points at a Sharp endpoint and reports what comes back — structure only.
 *
 * The questions in docs/sharp-api-intake.md are mostly answerable from one
 * real response, and far faster to answer that way than in a meeting. This
 * script asks them: is a row a receipt line or a day's total, does it carry a
 * time of day, a cashier, a customer, an EAN, a VAT figure, negative
 * quantities.
 *
 * Read-only. One GET. Nothing is created, updated or deleted.
 *
 * What it prints: field names, value types, lengths, counts, and dates and
 * times (which are the point of several questions). What it never prints:
 * a credential, or the value of any field — only its shape. A till feed may
 * contain a customer or an employee, and this script exists to find that out
 * without putting it on a terminal or in a scrollback.
 *
 *   npm run sharp:probe -- --path "/sales?from=2026-11-10&to=2026-11-10"
 *   npm run sharp:probe -- --url "https://.../whatever"
 *
 * Credentials come from .env.local, never from the command line:
 *
 *   SHARP_BASE_URL   joined with --path
 *   SHARP_API_KEY    sent as "Authorization: Bearer <key>", or
 *   SHARP_AUTH_HEADER / SHARP_AUTH_VALUE for anything else
 *
 * None of this assumes an endpoint exists. The path is an argument precisely
 * because we have not been told one.
 */

/** Field names whose *presence* answers a question and whose value never may be shown. */
const SENSITIVE = [
  "customer",
  "kund",
  "member",
  "medlem",
  "loyalty",
  "card",
  "kort",
  "personalidentitynum",
  "personnummer",
  "ssn",
  "cashier",
  "kassör",
  "kassor",
  "operator",
  "employee",
  "anställd",
  "anstalld",
  "clerk",
  "user",
  "email",
  "phone",
  "telefon",
  // Not personal data, but never worth printing either: a credential echoed
  // back in a response is still a credential.
  "token",
  "secret",
  "password",
  "apikey",
];

/** Field names that answer "is this a receipt line or a day's total?". */
const RECEIPT_LIKE = ["receipt", "kvitto", "transaction", "transaktion", "ticket", "bon"];

/** Field names that would carry a time of day. */
const TIME_LIKE = ["time", "tid", "timestamp", "datetime", "hour"];

const EAN_LIKE = ["ean", "gtin", "barcode", "streckkod"];
const VAT_LIKE = ["vat", "moms", "tax"];
const QUANTITY_LIKE = ["quantity", "qty", "antal", "count", "units"];

/** "amountInclVat" -> ["amount", "incl", "vat"]; "sale_tid" -> ["sale", "tid"]. */
function tokenize(key: string): string[] {
  return key
    .replace(/([a-zà-ÿ0-9])([A-ZÀ-Þ])/g, "$1 $2")
    .split(/[^A-Za-zÀ-ÿ0-9]+/)
    .filter(Boolean)
    .map((token) => token.toLowerCase());
}

/**
 * Loose, for deciding what to redact. A false positive here hides a harmless
 * value, which costs nothing; a false negative prints a customer's card
 * number.
 */
function containsNeedle(key: string, needles: string[]): boolean {
  const lower = key.toLowerCase();
  return needles.some((needle) => lower.includes(needle));
}

/**
 * Strict, for deciding what to *claim* in the report.
 *
 * A substring match finds "tid" inside "receiptId" and then tells you the feed
 * carries a time of day, which is both wrong and the kind of wrong somebody
 * acts on. So a short needle has to match a whole word; only a needle long
 * enough to be unambiguous may match inside one.
 */
function namedLike(key: string, needles: string[]): boolean {
  const tokens = tokenize(key);
  const lower = key.toLowerCase();
  return needles.some(
    (needle) => tokens.includes(needle) || (needle.length >= 5 && lower.includes(needle))
  );
}

/** A value's shape, never its content — except dates, which are a question. */
function describe(key: string, value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `array(${value.length})`;

  switch (typeof value) {
    case "string": {
      if (containsNeedle(key, SENSITIVE)) return `string(len=${value.length}) [REDACTED]`;
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return `datetime("${value}")`;
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `date("${value}")`;
      if (/^\d{2}:\d{2}(:\d{2})?$/.test(value)) return `time("${value}")`;
      return `string(len=${value.length})`;
    }
    case "number":
      if (containsNeedle(key, SENSITIVE)) return "number [REDACTED]";
      // A sign is a question ("are returns included?"); a magnitude is not.
      return value < 0 ? "number(negative)" : "number";
    case "boolean":
      return "boolean";
    case "object":
      return `object{${Object.keys(value as object).join(",")}}`;
    default:
      return typeof value;
  }
}

/** True for "2026-11-10T14:32:11" and "14:32", false for "2026-11-10". */
function carriesTimeOfDay(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) || /^\d{2}:\d{2}(:\d{2})?$/.test(value);
}

type Finding = { key: string; path: string };

const found = {
  sensitive: [] as Finding[],
  receipt: [] as Finding[],
  time: [] as Finding[],
  ean: [] as Finding[],
  vat: [] as Finding[],
  negativeQuantity: [] as Finding[],
};

/** Walks the payload, printing a tree and collecting the answers. */
function walk(value: unknown, path: string, depth: number, printed: { count: number }): void {
  const indent = "  ".repeat(depth);

  if (Array.isArray(value)) {
    console.log(`${indent}${path}: array(${value.length})`);
    // One element is enough to learn the shape, and a whole till day is not
    // something to print.
    if (value.length > 0 && depth < 6) walk(value[0], `${path}[0]`, depth + 1, printed);
    return;
  }

  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;

      if (namedLike(key, SENSITIVE)) found.sensitive.push({ key, path: childPath });
      if (namedLike(key, RECEIPT_LIKE)) found.receipt.push({ key, path: childPath });
      if (namedLike(key, EAN_LIKE)) found.ean.push({ key, path: childPath });
      if (namedLike(key, VAT_LIKE)) found.vat.push({ key, path: childPath });
      if (namedLike(key, QUANTITY_LIKE) && typeof child === "number" && child < 0) {
        found.negativeQuantity.push({ key, path: childPath });
      }

      // A time of day is found by shape as well as by name: the field that
      // carries one is as likely to be called `soldAt` as `time`.
      if (namedLike(key, TIME_LIKE) || carriesTimeOfDay(child)) {
        found.time.push({ key, path: childPath });
      }

      if (child !== null && typeof child === "object") {
        walk(child, childPath, depth, printed);
        continue;
      }

      if (printed.count < 400) {
        console.log(`${indent}${childPath}: ${describe(key, child)}`);
        printed.count += 1;
      }
    }
    return;
  }

  console.log(`${indent}${path}: ${describe(path, value)}`);
}

function report(label: string, findings: Finding[], whenEmpty: string): void {
  const unique = [...new Set(findings.map((finding) => finding.path))];
  console.log(`\n${label}`);
  if (unique.length === 0) {
    console.log(`  ${whenEmpty}`);
    return;
  }
  for (const path of unique.slice(0, 12)) console.log(`  ${path}`);
  if (unique.length > 12) console.log(`  …and ${unique.length - 12} more`);
}

function argument(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

async function main() {
  const explicitUrl = argument("url");
  const path = argument("path");
  const base = process.env.SHARP_BASE_URL ?? "";

  const url = explicitUrl ?? (path ? `${base.replace(/\/$/, "")}${path}` : null);

  if (!url) {
    console.error(
      [
        "Nothing to probe.",
        "",
        "  npm run sharp:probe -- --path \"/sales?from=2026-11-10&to=2026-11-10\"",
        "  npm run sharp:probe -- --url \"https://.../sales?...\"",
        "",
        "Set SHARP_BASE_URL in .env.local to use --path.",
        "See docs/sharp-api-intake.md for what we still need to be told.",
      ].join("\n")
    );
    process.exit(1);
  }

  const headers: Record<string, string> = { accept: "application/json" };
  if (process.env.SHARP_AUTH_HEADER && process.env.SHARP_AUTH_VALUE) {
    headers[process.env.SHARP_AUTH_HEADER] = process.env.SHARP_AUTH_VALUE;
  } else if (process.env.SHARP_API_KEY) {
    headers.authorization = `Bearer ${process.env.SHARP_API_KEY}`;
  } else {
    console.log("No credentials in the environment — sending the request unauthenticated.\n");
  }

  // The URL can carry a date in a query string, which is fine to show; a
  // credential is never in it, because credentials come from the environment.
  console.log(`GET ${url.replace(/([?&](key|token|apikey)=)[^&]*/gi, "$1<redacted>")}\n`);

  const started = Date.now();
  let response: Response;
  try {
    response = await fetch(url, { headers });
  } catch (error) {
    console.error(`Request failed: ${error instanceof Error ? error.message : "unknown error"}`);
    process.exit(1);
  }

  const contentType = response.headers.get("content-type") ?? "(none)";
  console.log(`HTTP ${response.status} ${response.statusText}`);
  console.log(`content-type: ${contentType}`);
  console.log(`took: ${Date.now() - started} ms`);

  const paging = ["x-total-count", "link", "x-page", "x-next-page"]
    .flatMap((name) => {
      const value = response.headers.get(name);
      return value ? [`${name}: ${value}`] : [];
    });
  if (paging.length > 0) console.log(`paging headers: ${paging.join(", ")}`);

  const body = await response.text();

  if (!contentType.includes("json")) {
    console.log(`\nNot JSON. ${body.length} characters. First line:`);
    console.log(`  ${body.split("\n")[0]?.slice(0, 200) ?? ""}`);
    process.exit(0);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    console.error("\nResponse claimed JSON but did not parse.");
    process.exit(1);
  }

  console.log("\nStructure (shapes only, no values):");
  walk(payload, "", 1, { count: 0 });

  console.log("\n" + "─".repeat(64));
  console.log("What this answers, from docs/sharp-api-intake.md");
  console.log("─".repeat(64));

  report(
    "Receipt-level fields — if these exist, a row is a transaction, not a day:",
    found.receipt,
    "none found, which points at daily totals (confirm with a busy store)"
  );
  report(
    "Time-of-day fields — we drop these, and must not store them:",
    found.time,
    "none found"
  );
  report(
    "Fields about a person — a cashier, an employee or a customer:",
    found.sensitive,
    "none found. Worth re-running against a day with a loyalty sale."
  );
  report("Product identifiers we can match on:", found.ean, "no EAN — matching will need the SKU");
  report("VAT or tax fields:", found.vat, "none found — ask whether amounts include VAT");
  report(
    "Negative quantities — returns reported as rows:",
    found.negativeQuantity,
    "none in this response; try a day you know had a return"
  );

  console.log(
    [
      "",
      "Still only answerable by asking: history depth, update frequency, whether a",
      "day is ever restated, when a trading day ends, and the rate limit.",
      "",
    ].join("\n")
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
