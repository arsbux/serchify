import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'puppeteer',
    'puppeteer-core',
    'google-trends-api',
    '@sparticuz/chromium'
  ]
};

export default nextConfig;
