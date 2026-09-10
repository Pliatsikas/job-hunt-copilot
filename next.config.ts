import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next's default already, but stated rather than assumed: source maps would
  // ship the server-adjacent code of every client component to anyone who
  // opens devtools on the public deployment.
  productionBrowserSourceMaps: false,
};

export default nextConfig;
