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

export const env = {
  DATABASE_URL: required('DATABASE_URL'),
  SESSION_SECRET: required('SESSION_SECRET'),
  MFA_ENCRYPTION_KEY: required('MFA_ENCRYPTION_KEY'),
  APP_URL: process.env.APP_URL ?? 'http://localhost:3000',
  isProduction: process.env.NODE_ENV === 'production',
};

/**
 * Secure cookies require HTTPS. Enabled in production only, so local http
 * development still works — this is the one attribute that cannot be set
 * unconditionally.
 */
export const useSecureCookies = env.isProduction;
