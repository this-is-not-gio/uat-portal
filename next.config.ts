import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Test case imports send up to 500 cases in one action (default is 1mb).
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
