import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Vercel's image optimiser is a billed feature; once the plan's quota ran
    // out every <Image> answered 402 OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED.
    // Serve the source files as-is instead.
    unoptimized: true,
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