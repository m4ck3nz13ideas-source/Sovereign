import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The fourth tab was Marketplace and is now Market. Old links keep working.
  async redirects() {
    return [
      { source: "/marketplace", destination: "/market", permanent: false },
      { source: "/marketplace/:path*", destination: "/market/:path*", permanent: false },
      // Chats moved from Individual to Home's side of the app.
      { source: "/individual/chats", destination: "/chats", permanent: false },
      { source: "/individual/chats/:path*", destination: "/chats/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
