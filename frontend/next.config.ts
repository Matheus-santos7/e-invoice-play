import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Monorepo: um único lockfile na raiz (pnpm)
  outputFileTracingRoot: path.join(__dirname, ".."),
};

export default nextConfig;
