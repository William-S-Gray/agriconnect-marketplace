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

export const env = {
  DATABASE_URL: required('DATABASE_URL'),
  MFA_ENCRYPTION_KEY: required('MFA_ENCRYPTION_KEY'),
  // Reset links and the CSRF allowlist are built from this. Defaulting to
  // localhost in production silently mailed links nobody could open.
  APP_URL: isProduction ? required('APP_URL') : (process.env.APP_URL ?? 'http://localhost:3000'),
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
