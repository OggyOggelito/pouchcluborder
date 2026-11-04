/**
 * Tap-target and overflow probe at 390x844.
 *
 * Reports interactive elements smaller than 44x44 and any page that scrolls
 * horizontally. Inline links inside prose are excluded: WCAG treats those as
 * text, and padding them to 44px would break the paragraphs they sit in.
 *
 * Usage: npm run ux:targets   (dev server must be running)
 */
import { chromium, type Page } from "playwright";

const BASE = process.env.UX_BASE_URL ?? "http://localhost:3000";

const ACCOUNTS = {
  admin: ["admin@pouchclub.se", "byt-mig-admin"],
  owner: ["taby-centrum@pouchclub.se", "byt-mig-butik"],
  staff: ["personal@pouchclub.se", "byt-mig-personal"],
} as const;

type RoleKey = keyof typeof ACCOUNTS;

const PAGES: [RoleKey, string][] = [
  ["owner", "/"],
  ["owner", "/order"],
  ["owner", "/orders"],
  ["owner", "/transfers"],
  ["staff", "/staff"],
  ["staff", "/staff/finder"],
  ["staff", "/news"],
  ["staff", "/my-schedule"],
  ["staff", "/store/notes"],
  ["staff", "/staff/checklists"],
  ["staff", "/settings"],
  ["admin", "/admin"],
  ["admin", "/admin/requests"],
];

async function signIn(page: Page, role: RoleKey) {
  const [email, password] = ACCOUNTS[role];
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
  let totalSmall = 0;
  let overflowing = 0;

  for (const role of ["owner", "staff", "admin"] as const) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: "sv-SE",
    });
    const page = await context.newPage();
    await signIn(page, role);

    for (const [, route] of PAGES.filter(([pageRole]) => pageRole === role)) {
      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" }).catch(() => undefined);
      await page.waitForTimeout(250);

      const small = await page.evaluate(() => {
        const found: { tag: string; text: string; w: number; h: number }[] = [];
        const selector = 'a, button, input, select, summary, [role="button"]';

        for (const element of Array.from(document.querySelectorAll(selector))) {
          const rect = (element as HTMLElement).getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          if (rect.width >= 44 && rect.height >= 44) continue;

          // A link inside a paragraph is text, not a control.
          const inProse = element.closest("p") !== null && element.tagName === "A";
          if (inProse) continue;

          // Visually hidden until focused — the skip link is 1x1 by design and
          // becomes a full-size control the moment it is tabbed to.
          if (rect.width <= 2 && rect.height <= 2) continue;

          // A checkbox or radio wrapped in a label: the whole label row is
          // what you tap, so measure that instead of the 20px control.
          const label = element.closest("label");
          if (label) {
            const labelRect = label.getBoundingClientRect();
            if (labelRect.width >= 44 && labelRect.height >= 44) continue;
          }

          found.push({
            tag: element.tagName.toLowerCase(),
            text: (
              (element as HTMLElement).innerText ||
              element.getAttribute("aria-label") ||
              ""
            )
              .trim()
              .slice(0, 30),
            w: Math.round(rect.width),
            h: Math.round(rect.height),
          });
        }
        return found;
      });

      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1
      );

      totalSmall += small.length;
      if (overflows) overflowing += 1;

      console.log(
        `${route.padEnd(20)} ${role.padEnd(6)} small=${String(small.length).padStart(3)}  h-scroll=${overflows}`
      );
      for (const item of small.slice(0, 4)) {
        console.log(`    ${item.tag} "${item.text}" ${item.w}x${item.h}`);
      }
    }

    await context.close();
  }

  await browser.close();
  console.log(`\n${totalSmall} undersized targets, ${overflowing} pages scrolling sideways.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
