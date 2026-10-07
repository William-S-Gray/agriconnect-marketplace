/**
 * Next.js configuration, including the static security headers.
 *
 * The Content-Security-Policy is NOT set here. It needs a fresh nonce per
 * request, because the App Router streams its payload through inline
 * <script> tags; a static `script-src 'self'` blocked every one of them and
 * left production pages without hydration. middleware.ts builds the policy.
 *
 * HSTS is only emitted in production: sending it from a plain-http dev server
 * would pin localhost to HTTPS in the browser and break local development.
 */

const isProd = process.env.NODE_ENV === 'production';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
  // Only meaningful over HTTPS, so production only.
  ...(isProd
    ? [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains',
        },
      ]
    : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The only next/image use is a data: URI rendered unoptimized, so the
  // /_next/image optimizer is pure attack surface here — it has carried
  // unauthenticated RCE and DoS advisories (e.g. GHSA-2xp9-vwfh-vxw4). Off.
  images: { unoptimized: true },
  /**
   * Loaded at runtime by Node rather than bundled by webpack.
   * @node-rs/argon2 ships a native .node binary, and pg pulls in optional
   * native bindings; webpack cannot parse either.
   */
  serverExternalPackages: ['@node-rs/argon2', 'pg'],
  experimental: {
    // Middleware runs on every API route, and Next buffers a request body up
    // to this size for it before the route sees it (default 10 MB). Routes
    // accept at most 64 KB (lib/http.ts), so nothing larger needs buffering.
    middlewareClientMaxBodySize: '128kb',
  },
  // Browsers request /favicon.ico on their own, regardless of the <link> tag.
  async redirects() {
    return [{ source: '/favicon.ico', destination: '/favicon.svg', permanent: true }];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
