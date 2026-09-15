import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "xlsx"],
  // Pin the workspace root: an unrelated package-lock.json in the home directory
  // would otherwise make Next.js infer the wrong root for file tracing.
  turbopack: { root: path.resolve(import.meta.dirname) },
};

export default nextConfig;
