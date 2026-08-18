/**
 * Next.js configuration, including security headers.
 *
 * CSP notes — this policy was derived from what the app actually loads, not
 * copied from a template:
 *   * 'unsafe-inline' for style-src is required by Tailwind's runtime style
 *     injection and by the inline style attributes Radix/recharts set for
 *     positioning and chart geometry.
 *   * 'unsafe-inline' for script-src is required in development by the Next.js
 *     dev overlay and React refresh. It is dropped in production, where Next
 *     emits nonced/external scripts only.
 *   * data: is allowed for img-src because the TOTP QR code and the farmer
 *     photo preview are data: URIs.
 *   * connect-src includes the Neon HTTPS endpoint, since the serverless driver
 *     talks to the database over fetch from server components — kept explicit
 *     rather than using a wildcard.
 *
 * HSTS is only emitted in production: sending it from a plain-http dev server
 * would pin localhost to HTTPS in the browser and break local development.
 */

const isProd = process.env.NODE_ENV === 'production';

const csp = [
  "default-src 'self'",
  isProd
    ? "script-src 'self'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.neon.tech",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(isProd ? ['upgrade-insecure-requests'] : []),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
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
  experimental: {
    /**
     * Loaded at runtime by Node rather than bundled by webpack.
     * @node-rs/argon2 ships a native .node binary, and pg pulls in optional
     * native bindings; webpack cannot parse either.
     */
    serverComponentsExternalPackages: ['@node-rs/argon2', 'pg'],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
