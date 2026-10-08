import type { MetadataRoute } from 'next';
import { sql } from '@/lib/db';
import { env } from '@/lib/env';

// Lists live listings, so it is built per request rather than at deploy time.
export const dynamic = 'force-dynamic';

/** Public pages, every listing a buyer can see, and every verified farm. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.APP_URL;
  const [listings, farms] = await Promise.all([
    sql<{ id: string; updated_at: Date }>`
      SELECT l.id, l.updated_at FROM listings l JOIN farmers f ON f.id = l.farmer_id
       WHERE l.status = 'ACTIVE' AND l.is_available AND f.status = 'VERIFIED' AND l.quantity_kg > 0`,
    sql<{ id: string; updated_at: Date }>`SELECT id, updated_at FROM farmers WHERE status = 'VERIFIED'`,
  ]);
  return [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/browse`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${base}/prices`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${base}/register`, changeFrequency: 'monthly', priority: 0.5 },
    ...listings.map((l) => ({ url: `${base}/listing/${l.id}`, lastModified: l.updated_at, priority: 0.8 })),
    ...farms.map((f) => ({ url: `${base}/farmer/${f.id}`, lastModified: f.updated_at, priority: 0.6 })),
  ];
}
