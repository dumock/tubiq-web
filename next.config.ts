import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Turbopack from bundling puppeteer (causes Windows symlink errors)
  serverExternalPackages: ['puppeteer', 'puppeteer-core'],
};

export default nextConfig;

// Force restart for cache clear 2
