/**
 * Screenshots for the theming work, at 390x844.
 *
 * Usage: npm run theme:shots -- before     (dev server must be running)
 *
 * Covers the screens the theme has to survive: the two surfaces (page and
 * card), a filled and an empty state, an error state, inputs, badges, a
 * status timeline and a print view.
 */
import { chromium, type Page } from "playwright";
import path from "node:path";
import { mkdirSync } from "node:fs";

const BASE = process.env.UX_BASE_URL ?? "http://localhost:3000";
const label = process.argv[2] ?? "before";
const outDir = path.join(process.cwd(), "docs", "theme", label);

const ACCOUNTS = {
  admin: { email: "admin@pouchclub.se", password: "byt-mig-admin" },
  owner: { email: "taby-centrum@pouchclub.se", password: "byt-mig-butik" },
  staff: { email: "personal@pouchclub.se", password: "byt-mig-personal" },
} as const;

type RoleKey = keyof typeof ACCOUNTS;

/** [route, file name, optional setup] */
type Shot = [string, string, ((page: Page) => Promise<void>)?];

async function addThreeItems(page: Page) {
  for (const term of ["Zyn", "Loop", "Velo"]) {
    await page.fill('input[type="search"]', term);
    await page.waitForTimeout(400);
    const plus = page.locator('button[aria-label^="Öka"]').first();
    if ((await plus.count()) > 0) await plus.click();
  }
  await page.fill('input[type="search"]', "");
  await page.waitForTimeout(300);
}

const SHOTS: { role: RoleKey | null; shots: Shot[] }[] = [
  { role: null, shots: [["/login", "login"]] },
  {
    role: "owner",
    shots: [
      ["/", "home"],
      ["/order", "order-empty"],
      ["/order", "order-filled", addThreeItems],
      ["/orders", "orders"],
      ["/transfers", "transfers"],
      ["/store/notes", "store-notes"],
    ],
  },
  {
    role: "staff",
    shots: [
      ["/staff", "guide"],
      ["/staff/finder", "finder"],
      ["/news", "news"],
      ["/staff/checklists", "checklist"],
      ["/staff/quizzes", "quiz"],
      ["/my-schedule", "schedule"],
      ["/settings", "settings"],
      ["/admin", "forbidden"],
    ],
  },
  {
    role: "admin",
    shots: [
      ["/admin", "admin-hub"],
      ["/admin/requests", "admin-requests"],
      ["/admin/issues", "admin-issues-empty"],
      ["/admin/review", "admin-review"],
      ["/staff/brands/loop", "brand-loop"],
      ["/admin/routines", "admin-routines"],
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
  const browser = await chromium.launch({ channel: process.env.UX_CHANNEL ?? "chrome" });

  try {
    for (const group of SHOTS) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        locale: "sv-SE",
        timezoneId: "Europe/Stockholm",
      });
      const page = await context.newPage();
      if (group.role) await signIn(page, group.role);

      for (const [route, name, setup] of group.shots) {
        await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" }).catch(() => undefined);
        if (setup) await setup(page);
        await page.waitForTimeout(350);
        await page.screenshot({ path: path.join(outDir, `${name}.png`) });
        console.log(`${label}/${name}.png  <-  ${group.role ?? "signed out"} ${route}`);
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
