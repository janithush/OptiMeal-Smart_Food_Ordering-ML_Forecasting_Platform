import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Production hardening
  poweredByHeader: false,
  reactStrictMode: true,
  // Emit a self-contained `standalone` build for Docker. The default
  // Next.js output is used on Vercel because Next.js 16.3.0 has a known
  // bug (vercel/next.js#96646) where the Vercel adapter's onBuildComplete
  // hook reads `.next/next-server.js.nft.json`, but `output: "standalone"`
  // no longer emits that file in 16.3.x, causing:
  //   Error: ENOENT: no such file or directory,
  //         open '/vercel/path0/.next/next-server.js.nft.json'
  // Keeping `standalone` for Docker (which copies `.next/standalone/`
  // directly) and using the default output on Vercel is the official
  // workaround from the Next.js team.
  output: process.env.VERCEL ? undefined : "standalone",

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },

  // Security headers (defense-in-depth; CSP would be ideal but the
  // third-party PayHere iframe conflicts with strict-dynamic).
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), geolocation=(), microphone=()",
          },
        ],
      },
      {
        // Webhook endpoint MUST NOT be cached
        source: "/api/wallet/webhook",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
        ],
      },
    ];
  },

  // Skip type-checking during lint time; we have a separate CI step
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;