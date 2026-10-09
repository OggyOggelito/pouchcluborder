import "server-only";
import {
  EMPLOYEES_PATH,
  acquireToken,
  missingTooEasyConfig,
  readTooEasyConfig,
} from "@/lib/schedule/tooeasy-provider";
import {
  stripEmployeeRows,
  type RawEmployeeRow,
  type TooEasyEmployeeOption,
} from "@/lib/schedule/tooeasy-mapper";

/**
 * The employee list, for the mapping dropdown only.
 *
 * `EmployeeMDL` has 76 fields including `PersonalIdentityNum` and
 * `ProtectedIdentity`. Exactly two leave this function — an employee number
 * and a display name — and the rest are never copied, stored or logged.
 * Anyone flagged `ProtectedIdentity` is dropped entirely and only counted, so
 * their name never reaches a page; they are mapped by hand instead.
 */
export type { TooEasyEmployeeOption };

export type EmployeeDirectory = {
  options: TooEasyEmployeeOption[];
  /** Excluded because ProtectedIdentity is set — count only, never names. */
  protectedCount: number;
  fetchedAt: number;
};

type EmployeesResponse = { items?: RawEmployeeRow[] | null; results?: RawEmployeeRow[] | null };

export async function fetchTooEasyEmployees(limit = 500): Promise<EmployeeDirectory> {
  const missing = missingTooEasyConfig();
  if (missing.length > 0) {
    throw new Error(`TooEasy är inte konfigurerat: ${missing.join(", ")} saknas.`);
  }

  const config = readTooEasyConfig();
  const token = await acquireToken(config);

  const url = new URL(`${config.baseUrl}${EMPLOYEES_PATH}`);
  url.searchParams.set("start", "0");
  url.searchParams.set("num", String(limit));
  // Ask for only what we need. If the API ignores `fields`, the stripping
  // below is still what decides; this is a courtesy, not the control.
  url.searchParams.set("fields", "EmployeeId,FirstName,LastName,Inactive,ProtectedIdentity");

  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token.token}`, accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`TooEasy svarade HTTP ${response.status} på medarbetarlistan.`);
  }

  const payload = (await response.json()) as EmployeesResponse;
  const rows = payload.items ?? payload.results ?? [];

  const { options, protectedCount } = stripEmployeeRows(rows);
  return { options, protectedCount, fetchedAt: Date.now() };
}

