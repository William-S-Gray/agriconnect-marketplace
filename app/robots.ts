import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

/** Public pages are crawlable; accounts, dashboards and the API are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/buyer', '/farm/', '/settings', '/api/', '/login/mfa', '/reset-password', '/verify-email'],
    },
    sitemap: `${env.APP_URL}/sitemap.xml`,
  };
}
