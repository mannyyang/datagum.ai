import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Externalize canvas for linkedom (Workers-compatible HTML parsing)
  // This works for both Webpack and Turbopack
  serverExternalPackages: ['canvas', 'linkedom'],
};

export default nextConfig;

// added by create cloudflare to enable calling `getCloudflareContext()` in `next dev`
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
initOpenNextCloudflareForDev();
