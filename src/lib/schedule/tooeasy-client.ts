/**
 * TooEasy HTTP primitives: config, environment, paths and token acquisition.
 *
 * Deliberately NOT marked `server-only`, unlike the provider that uses it.
 * `server-only` is an alias Next's bundler supplies, so anything importing it
 * cannot run under plain tsx — which broke `scripts/tooeasy-probe.ts`. The
 * marker stays on tooeasy-provider.ts, queries.ts, cache.ts, status.ts and
 * tooeasy-employees.ts, i.e. everything a page or component might plausibly
 * import.
 *
 * Nothing here is unsafe in a browser bundle anyway: it reads credentials from
 * process.env, and Next only exposes NEXT_PUBLIC_* to the client, so these
 * would be undefined rather than leaked.
 */
import { parseTokenResponse } from "@/lib/schedule/tooeasy-mapper";

export const TOKEN_PATH = "/api/RequestNewToken/AcquireToken";
export const SHIFTS_PATH = "/api/Schedule/GetItemsForAction";
export const EMPLOYEES_PATH = "/api/Employee/employees";

/** Used only when the response carries no expiry and the JWT has no `exp`. */
export const FALLBACK_TTL_MS = 50 * 60 * 1000;

export type TooEasyConfig = {
  baseUrl: string;
  userName: string;
  password: string;
};

export type AcquiredToken = { token: string; expiresAt: number };

export function readTooEasyConfig(): TooEasyConfig {
  return {
    baseUrl: (process.env.TOOEASY_BASE_URL ?? "").replace(/\/$/, ""),
    userName: process.env.TOOEASY_USERNAME ?? "",
    password: process.env.TOOEASY_PASSWORD ?? "",
  };
}

export function missingTooEasyConfig(config = readTooEasyConfig()): string[] {
  return [
    !config.baseUrl && "TOOEASY_BASE_URL",
    !config.userName && "TOOEASY_USERNAME",
    !config.password && "TOOEASY_PASSWORD",
  ].filter((value): value is string => Boolean(value));
}

/** "…/tooeasyDemoNew/…" -> demo. Reported in the admin panel. */
export function describeEnvironment(baseUrl: string): "demo" | "production" | "unknown" {
  if (!baseUrl) return "unknown";
  if (/demo|sandbox|test/i.test(baseUrl)) return "demo";
  return "production";
}

export async function acquireToken(config: TooEasyConfig): Promise<AcquiredToken> {
  const response = await fetch(`${config.baseUrl}${TOKEN_PATH}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ userName: config.userName, userPw: config.password }),
    cache: "no-store",
  });

  if (!response.ok) {
    // The body is deliberately not echoed: a failed auth response can repeat
    // back what was sent.
    throw new Error(`TooEasy token request failed (HTTP ${response.status}).`);
  }

  const parsed = parseTokenResponse(await response.text());
  if (!parsed) {
    throw new Error(
      "TooEasy returned no recognisable token. Run `npm run tooeasy:probe` to see the " +
        "response shape — the spec documents it only as `200 OK` with no schema."
    );
  }

  return {
    token: parsed.token,
    expiresAt: parsed.expiresAt ?? Date.now() + FALLBACK_TTL_MS,
  };
}
