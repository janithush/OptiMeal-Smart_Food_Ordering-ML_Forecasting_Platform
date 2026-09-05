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

  // Security headers (defense-in-depth; CSP Level 3 compatible with
  // Next.js inline scripts + PayHere iframe + Google OAuth).
  async headers() {
    const csp = [
      "default-src 'self'",
      // Next.js requires 'unsafe-inline' for runtime scripts; no 'unsafe-eval'.
      "script-src 'self' 'unsafe-inline' https://www.payhere.lk https://sandbox.payhere.lk https://accounts.google.com https://apis.google.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://images.unsplash.com https://res.cloudinary.com https://lh3.googleusercontent.com",
      "connect-src 'self' https://accounts.google.com https://www.payhere.lk https://sandbox.payhere.lk",
      "frame-src 'self' https://www.payhere.lk https://sandbox.payhere.lk https://accounts.google.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://www.payhere.lk https://sandbox.payhere.lk https://accounts.google.com",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          // HSTS 2-year forced HTTPS (effective on HTTPS deployments).
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Browser tab memory isolation.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), geolocation=(), microphone=()",
          },
        ],
      },
      {
        // Service worker MUST NOT be cached — stale SW = stale app shell.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
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