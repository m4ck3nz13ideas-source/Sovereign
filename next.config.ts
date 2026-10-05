import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The fourth tab was Marketplace and is now Market. Old links keep working.
  async redirects() {
    return [
      { source: "/marketplace", destination: "/market", permanent: false },
      { source: "/marketplace/:path*", destination: "/market/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
