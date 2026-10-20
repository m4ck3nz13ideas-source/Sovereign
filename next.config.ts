import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Link-preview images read their fonts from disk at request time.
  outputFileTracingIncludes: {
    "/**": ["./assets/og/**/*"],
  },
  // The fourth tab was Marketplace and is now Market. Old links keep working.
  async redirects() {
    return [
      { source: "/marketplace", destination: "/market", permanent: false },
      { source: "/marketplace/:path*", destination: "/market/:path*", permanent: false },
      // Chats moved from Individual to Home's side of the app.
      { source: "/individual/chats", destination: "/chats", permanent: false },
      { source: "/individual/chats/:path*", destination: "/chats/:path*", permanent: false },
      // 20 October: People moved to Connection, Words to Search, and Impact
      // into Projects. Old links keep working.
      { source: "/collective/people", destination: "/connection/people", permanent: false },
      { source: "/collective/people/:path*", destination: "/connection/people/:path*", permanent: false },
      { source: "/collective/lexicon", destination: "/home/words", permanent: false },
      { source: "/collective/lexicon/:path*", destination: "/home/words/:path*", permanent: false },
      { source: "/collective/impact", destination: "/collective/projects#impact", permanent: false },
    ];
  },
};

export default nextConfig;
