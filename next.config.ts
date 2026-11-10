import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "xlsx"],

  /**
   * Addresses that moved.
   *
   * Here rather than as a page that calls `redirect()`: the app's layout is
   * async, so a redirect from inside a page streams as a client-side
   * navigation with no Location header. That is fine in a browser and no use
   * to anything else. These are real 308s.
   *
   * The schedule moved when it stopped being imported and started being typed
   * in by the stores: /my-schedule is now /schedule, and the read-only team
   * grid at /team-schedule is the editable week at /store/schedule.
   */
  async redirects() {
    return [
      { source: "/my-schedule", destination: "/schedule", permanent: true },
      { source: "/team-schedule", destination: "/store/schedule", permanent: true },
    ];
  },
  // Pin the workspace root: an unrelated package-lock.json in the home directory
  // would otherwise make Next.js infer the wrong root for file tracing.
  turbopack: { root: path.resolve(import.meta.dirname) },
};

export default nextConfig;
