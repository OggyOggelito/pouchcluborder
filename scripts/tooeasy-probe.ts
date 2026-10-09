/**
 * Answers the three open questions about the TooEasy API against a real
 * environment, and prints only structure.
 *
 * Read-only: one token POST plus GETs. Nothing is created, updated or deleted.
 *
 * What it prints: field names, value shapes, counts, dates, times and HTTP
 * statuses. What it never prints: the token itself, credentials, employee
 * names, personnummer, or any cost figure. Values are passed through
 * `describe()`, which reports a type and a shape rather than content.
 *
 *   npm run tooeasy:probe -- --date 2026-10-15
 *
 * `--date` should be a day you know has a shift; without it the probe still
 * reports the token shape and the payload structure, but cannot pin down the
 * date-window semantics.
 */
import {
  acquireToken,
  describeEnvironment,
  missingTooEasyConfig,
  readTooEasyConfig,
  SHIFTS_PATH,
  TOKEN_PATH,
} from "../src/lib/schedule/tooeasy-provider";
import { expFromJwt, hasUtcOffset } from "../src/lib/schedule/tooeasy-mapper";

/** Keys whose values must never be printed, at any depth. */
const FORBIDDEN = new Set(
  [
    "personalidentitynum",
    "firstname",
    "lastname",
    "name",
    "email",
    "totalcost",
    "obcost",
    "payrolltaxes",
    "costexpayrolltax",
    "token",
    "access_token",
    "jwt",
    "password",
    "userpw",
  ].map((key) => key.toLowerCase())
);

/** A value's shape, never its content. */
function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `array(${value.length})`;
  switch (typeof value) {
    case "string":
      if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
        return `datetime("${value}")`; // dates/times are explicitly allowed
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `date("${value}")`;
      return `string(len=${value.length})`;
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "object":
      return `object{${Object.keys(value as object).join(",")}}`;
    default:
      return typeof value;
  }
}

function printShape(label: string, value: unknown, indent = "  ") {
  console.log(`${indent}${label}:`);
  if (!value || typeof value !== "object") {
    console.log(`${indent}  ${describe(value)}`);
    return;
  }
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    const safe = FORBIDDEN.has(key.toLowerCase()) ? "<redacted>" : describe(inner);
    console.log(`${indent}  ${key}: ${safe}`);
  }
}

function arg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const config = readTooEasyConfig();
  const missing = missingTooEasyConfig(config);

  console.log("=== TooEasy probe ===\n");

  if (missing.length > 0) {
    console.error(`Not configured — missing: ${missing.join(", ")}.`);
    console.error("Put TOOEASY_BASE_URL, TOOEASY_USERNAME and TOOEASY_PASSWORD in .env.local.");
    process.exit(1);
  }

  const environment = describeEnvironment(config.baseUrl);
  // The host and path segment are printed because they are what answers
  // "demo or production"; credentials are never printed.
  console.log(`Environment : ${environment.toUpperCase()}`);
  console.log(`Base URL    : ${config.baseUrl}`);
  console.log(`Credentials : configured (values not shown)\n`);

  // -- Q1: token response shape -------------------------------------------
  console.log("--- Q1: token response ---");
  const started = Date.now();
  const raw = await fetch(`${config.baseUrl}${TOKEN_PATH}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ userName: config.userName, userPw: config.password }),
    cache: "no-store",
  });
  console.log(`  POST ${TOKEN_PATH} -> HTTP ${raw.status} (${Date.now() - started}ms)`);
  console.log(`  content-type: ${raw.headers.get("content-type") ?? "(none)"}`);

  const text = await raw.text();
  let parsedBody: unknown = null;
  try {
    parsedBody = JSON.parse(text);
  } catch {
    console.log(`  body is not JSON; shape: ${describe(text)}`);
  }
  if (parsedBody && typeof parsedBody === "object") {
    printShape("body fields", parsedBody);
  }

  const token = await acquireToken(config);
  const exp = expFromJwt(token.token);
  console.log(`  token acquired: yes (value not shown)`);
  console.log(`  JWT exp claim : ${exp ? new Date(exp).toISOString() : "none"}`);
  console.log(
    `  cache until   : ${new Date(token.expiresAt).toISOString()} ` +
      `(${Math.round((token.expiresAt - Date.now()) / 60000)} min)\n`
  );

  // -- Q2 + Q3: shifts ------------------------------------------------------
  const employeeNo = arg("--employee");
  const date = arg("--date");

  if (!employeeNo || !date) {
    console.log("--- Q2/Q3: skipped ---");
    console.log("  Pass --employee <EmployeeId> --date <YYYY-MM-DD> for a day you know");
    console.log("  has a shift, to pin down the window semantics and the timezone.\n");
    return;
  }

  console.log(`--- Q2: window semantics (anchor ${date}) ---`);
  for (const daysBack of [0, 1, 2]) {
    const url = new URL(`${config.baseUrl}${SHIFTS_PATH}`);
    url.searchParams.set("startDate", date);
    url.searchParams.set("numberOfDaysBack", String(daysBack));
    url.searchParams.set("employeeNo", employeeNo);

    const response = await fetch(url, {
      headers: { authorization: `Bearer ${token.token}`, accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      console.log(`  numberOfDaysBack=${daysBack} -> HTTP ${response.status}`);
      continue;
    }

    const payload = (await response.json()) as {
      stores?: { StoreNumber?: string; employees?: { days?: { Date?: string }[] }[] }[];
    };
    const dates = new Set<string>();
    for (const store of payload.stores ?? []) {
      for (const employee of store.employees ?? []) {
        for (const day of employee.days ?? []) {
          if (day.Date) dates.add(String(day.Date).slice(0, 10));
        }
      }
    }
    const sorted = [...dates].sort();
    console.log(
      `  numberOfDaysBack=${daysBack} -> ${sorted.length} day(s): ` +
        `${sorted[0] ?? "-"} .. ${sorted[sorted.length - 1] ?? "-"}`
    );
  }

  console.log("\n--- Q3: timezone + payload shape ---");
  const url = new URL(`${config.baseUrl}${SHIFTS_PATH}`);
  url.searchParams.set("startDate", date);
  url.searchParams.set("numberOfDaysBack", "14");
  url.searchParams.set("employeeNo", employeeNo);

  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token.token}`, accept: "application/json" },
    cache: "no-store",
  });
  console.log(`  GET ${SHIFTS_PATH} -> HTTP ${response.status}`);
  if (!response.ok) return;

  const payload = (await response.json()) as Record<string, unknown>;
  printShape("top level", payload);

  const stores = (payload.stores ?? []) as Record<string, unknown>[];
  console.log(`  stores: ${stores.length}`);
  if (stores[0]) printShape("stores[0]", stores[0], "    ");

  const employees = (stores[0]?.employees ?? []) as Record<string, unknown>[];
  if (employees[0]) printShape("employees[0]", employees[0], "      ");

  const days = (employees[0]?.days ?? []) as Record<string, unknown>[];
  if (days[0]) printShape("days[0]", days[0], "        ");

  const actions = (days.find((day) => ((day.actions as unknown[]) ?? []).length > 0)
    ?.actions ?? []) as Record<string, unknown>[];
  if (actions[0]) {
    printShape("actions[0] (Pass)", actions[0], "          ");

    const start = String(actions[0].StartTime ?? "");
    console.log(`\n  StartTime carries a UTC offset? ${hasUtcOffset(start) ? "YES" : "no"}`);
    console.log(
      hasUtcOffset(start)
        ? "  -> times are instants, NOT local wall-clock. The provider must convert " +
            "to Europe/Stockholm instead of slicing."
        : "  -> local wall-clock. Slicing the literal time is correct."
    );
  } else {
    console.log("  no shifts in the window — pick a --date that has one.");
  }

  console.log("\nDone. Nothing was created, updated or deleted.");
}

main().catch((error) => {
  console.error(`Probe failed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
