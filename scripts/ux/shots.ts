/**
 * Screenshots of the main screens at 390x844, for docs/ux/before and after.
 *
 * Usage: npm run ux:shots -- before      (dev server must be running)
 *
 * Signs in through the real credentials form rather than forging a cookie, so
 * what is captured is what a person would actually see.
 */
import { chromium, type Page } from "playwright";
import path from "node:path";
import { mkdirSync } from "node:fs";

const BASE = process.env.UX_BASE_URL ?? "http://localhost:3000";
const label = process.argv[2] ?? "before";
const outDir = path.join(process.cwd(), "docs", "ux", label);

/** Placeholder seed passwords; see README "Accounts and access". */
const ACCOUNTS = {
  admin: { email: "admin@pouchclub.se", password: "byt-mig-admin" },
  owner: { email: "taby-centrum@pouchclub.se", password: "byt-mig-butik" },
  staff: { email: "personal@pouchclub.se", password: "byt-mig-personal" },
} as const;

type RoleKey = keyof typeof ACCOUNTS;

/** route -> file name, per role. */
const SHOTS: { role: RoleKey; routes: [string, string][] }[] = [
  {
    role: "owner",
    routes: [
      ["/", "owner-home"],
      ["/order", "owner-order"],
      ["/orders", "owner-orders"],
      ["/transfers", "owner-transfers"],
      ["/store/notes", "owner-notes"],
    ],
  },
  {
    role: "staff",
    routes: [
      ["/", "staff-home"],
      ["/staff", "staff-guide"],
      ["/staff/finder", "staff-finder"],
      ["/my-schedule", "staff-schedule"],
      ["/news", "staff-news"],
      ["/staff/checklists", "staff-checklists"],
      ["/settings", "staff-settings"],
    ],
  },
  {
    role: "admin",
    routes: [
      ["/admin", "admin-hub"],
      ["/admin/requests", "admin-requests"],
      ["/admin/review", "admin-review"],
    ],
  },
];

async function signIn(page: Page, role: RoleKey) {
  const { email, password } = ACCOUNTS[role];
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 }),
    page.click('button[type="submit"]'),
  ]).catch(() => undefined);
}

async function main() {
  mkdirSync(outDir, { recursive: true });

  // Uses the Chrome already on the machine rather than downloading
  // Playwright's own build — the cached browsers are an older revision than
  // this Playwright expects, and a 130 MB download for screenshots is a poor
  // trade. Set UX_CHANNEL= to fall back to a bundled chromium.
  const channel = process.env.UX_CHANNEL ?? "chrome";
  const browser = await chromium.launch(channel ? { channel } : {});
  try {
    for (const group of SHOTS) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        locale: "sv-SE",
        timezoneId: "Europe/Stockholm",
      });
      const page = await context.newPage();
      await signIn(page, group.role);

      for (const [route, name] of group.routes) {
        await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" }).catch(() => undefined);
        // Let sticky headers and any client transition settle.
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(outDir, `${name}.png`) });
        console.log(`${label}/${name}.png  <-  ${group.role} ${route}`);
      }

      await context.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
