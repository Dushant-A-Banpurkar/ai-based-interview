import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        // destination: "https://ai-based-job-tracker.onrender.com/api/:path*",
        destination: "https://ai-based-job-tracker-y9bo.onrender.com/api/:path*",
      },
    ];
  },
};

export default nextConfig;
