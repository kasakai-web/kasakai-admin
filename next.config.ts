import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 365,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-ccd9e78e9dec4ad6a14a20eeea6cb535.r2.dev"
      }
    ]
  }
};

export default nextConfig;
