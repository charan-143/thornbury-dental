import type { NextConfig } from "next";

/**
 * Security headers.
 *
 * These are the defence-in-depth layer. Authorisation still happens on every
 * data access in lib/authz.ts; headers only reduce the blast radius of a
 * mistake elsewhere. Every value here is deliberately restrictive, because a
 * portal holding health records is a poor place to discover that a permissive
 * default was inherited.
 */
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  // Next injects inline bootstrap scripts, so unsafe-inline is required for
  // scripts until a nonce-based setup replaces it. Documented, not forgotten.
  // unsafe-eval is added in development only, because the dev-mode HMR runtime
  // compiles with eval. Production never gets it.
  [
    "script-src 'self' 'unsafe-inline'",
    process.env.NODE_ENV === "development" ? "'unsafe-eval'" : "",
    "https://cdn.jsdelivr.net",
  ].filter(Boolean).join(" "),
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
  "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
  "img-src 'self' data: blob: https://picsum.photos https://fastly.picsum.photos",
  "connect-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Server packages excluded from Webpack bundling to prevent vendor chunk issues
  serverExternalPackages: ["@electric-sql/pglite", "@neondatabase/serverless"],

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
    ],
  },

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
