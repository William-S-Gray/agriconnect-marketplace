/**
 * Validated server-side environment. Importing this from client code is a bug:
 * every value here is a secret or a server-only setting.
 */
import 'server-only';

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required environment variable ${name}. See .env.example.`,
    );
  }
  return value;
}

const isProduction = process.env.NODE_ENV === 'production';

/**
 * On Vercel, previews run as production builds but each gets its own hostname,
 * so APP_URL (set for the Production environment) falls back to the
 * deployment's branch URL there. Production must still set APP_URL: the
 * custom domain is what links in emails should point to.
 */
function vercelUrl(): string | undefined {
  if (process.env.VERCEL_ENV !== 'preview') return undefined;
  const host = process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL;
  return host ? `https://${host}` : undefined;
}

export const env = {
  DATABASE_URL: required('DATABASE_URL'),
  MFA_ENCRYPTION_KEY: required('MFA_ENCRYPTION_KEY'),
  // Reset links and the CSRF allowlist are built from this. Defaulting to
  // localhost in production silently mailed links nobody could open.
  APP_URL: process.env.APP_URL || vercelUrl() || (isProduction ? required('APP_URL') : 'http://localhost:3000'),
  /**
   * No payment provider is integrated. Checkout only records orders as paid
   * into escrow when this is explicitly 'true' (the demo); otherwise it
   * refuses, rather than marking unpaid orders HELD_ESCROW.
   */
  SIMULATED_PAYMENTS: process.env.SIMULATED_PAYMENTS === 'true',
  isProduction,
};

/**
 * Secure cookies require HTTPS. Enabled in production only, so local http
 * development still works — this is the one attribute that cannot be set
 * unconditionally.
 */
export const useSecureCookies = env.isProduction;
