import { existsSync } from "node:fs";
import path from "node:path";

/**
 * The header brand mark.
 *
 * Shows `public/brand/logo.svg` if that file exists, and the words "Pouch
 * Club" set in the type scale if it does not. Dropping the real logo into
 * that path is the whole job — nothing else needs editing.
 *
 * The check runs once per server start rather than per render: the file does
 * not appear while the process is running, and a `statSync` on every request
 * for a header is wasted work. Restart after adding it.
 */
const LOGO_PATH = "/brand/logo.svg";

const hasLogo = existsSync(path.join(process.cwd(), "public", "brand", "logo.svg"));

export default function Wordmark() {
  if (hasLogo) {
    // eslint-disable-next-line @next/next/no-img-element -- an SVG the project
    // owns; next/image would rasterise it for no gain.
    return <img src={LOGO_PATH} alt="Pouch Club" className="h-8 w-auto" />;
  }

  return (
    <span className="text-lg font-bold tracking-tight text-ink">
      Pouch Club
    </span>
  );
}
