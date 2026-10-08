import 'server-only';
import { cache } from 'react';
import { sql } from './db';
import { num } from './serialize';

export interface ListingSummary {
  title: string;
  description: string;
  price: string; // "$6.50 / head"
  farmName: string;
  place: string; // "Gweru, Midlands"
}

/**
 * The few fields a link preview needs, for listings buyers can actually see.
 * Cached per request, so the page metadata and the preview image share one
 * query when both render.
 */
export const listingSummary = cache(async (id: string): Promise<ListingSummary | null> => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await sql<{
    title: string; description: string | null; price_per_unit: string; quantity_unit: string;
    farm_name: string; district: string; province: string;
  }>`
    SELECT l.title, l.description, l.price_per_unit, l.quantity_unit,
           f.farm_name, l.district, l.province
      FROM listings l JOIN farmers f ON f.id = l.farmer_id
     WHERE l.id = ${id} AND f.status = 'VERIFIED'
     LIMIT 1`;
  if (!row) return null;
  return {
    title: row.title,
    description: row.description ?? '',
    price: `$${num(row.price_per_unit).toFixed(2)} / ${row.quantity_unit}`,
    farmName: row.farm_name,
    place: [row.district, row.province].filter(Boolean).join(', '),
  };
});
