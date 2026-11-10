/**
 * axe-core accessibility scan of the main screens at 390x844.
 *
 * Usage: npm run ux:axe            (dev server must be running)
 *        npm run ux:axe -- --json  to print the full violation list
 *
 * Reports serious and critical violations per route; those are the ones the
 * UX task commits to fixing.
 */
import { AxeBuilder } from "@axe-core/playwright";
import { chromium, type Page } from "playwright";

const BASE = process.env.UX_BASE_URL ?? "http://localhost:3000";
const asJson = process.argv.includes("--json");

const ACCOUNTS = {
  admin: { email: "admin@pouchclub.se", password: "byt-mig-admin" },
  owner: { email: "taby-centrum@pouchclub.se", password: "byt-mig-butik" },
  staff: { email: "personal@pouchclub.se", password: "byt-mig-personal" },
} as const;

type RoleKey = keyof typeof ACCOUNTS;

const PAGES: { role: RoleKey; routes: string[] }[] = [
  {
    role: "owner",
    routes: [
      "/",
      "/order",
      "/orders",
      "/transfers",
      "/store/schedule",
      "/store/schedule/copy",
      "/schedule/available",
      "/schedule/extra",
      "/store/employees",
    ],
  },
  {
    role: "staff",
    routes: ["/staff", "/staff/finder", "/news", "/schedule", "/store/notes", "/staff/routines"],
  },
  {
    role: "admin",
    routes: [
      "/admin",
      "/admin/requests",
      "/admin/issues",
      "/admin/review",
      "/admin/schedule",
      "/admin/nearby",
      "/settings",
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
  const browser = await chromium.launch({ channel: process.env.UX_CHANNEL ?? "chrome" });
  let total = 0;

  try {
    for (const group of PAGES) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        locale: "sv-SE",
      });
      const page = await context.newPage();
      await signIn(page, group.role);

      for (const route of group.routes) {
        await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" }).catch(() => undefined);
        await page.waitForTimeout(300);

        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();

        const serious = results.violations.filter(
          (violation) => violation.impact === "serious" || violation.impact === "critical"
        );
        total += serious.length;

        const summary = serious
          .map((violation) => `${violation.id}(${violation.nodes.length})`)
          .join(", ");
        console.log(
          `${route.padEnd(22)} ${group.role.padEnd(6)} ${serious.length === 0 ? "clean" : summary}`
        );

        if (asJson && serious.length > 0) {
          for (const violation of serious) {
            console.log(`    ${violation.id}: ${violation.help}`);
            for (const node of violation.nodes.slice(0, 3)) {
              console.log(`      ${node.target.join(" ")}`);
            }
          }
        }
      }

      await context.close();
    }
  } finally {
    await browser.close();
  }

  console.log(`\n${total} serious/critical violations in total.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
