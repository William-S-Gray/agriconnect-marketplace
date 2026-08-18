/**
 * Maps database rows to the plain shapes the UI components already expect.
 *
 * Two conversions matter and are easy to get wrong:
 *   * pg returns NUMERIC as a *string* to avoid float precision loss. Prices and
 *     quantities must be converted explicitly or `price.toFixed()` throws and
 *     arithmetic silently concatenates.
 *   * Date objects cannot cross the server/client boundary in Next, so
 *     timestamps are emitted as ISO strings.
 *
 * Nothing here is security-relevant, but every value passed to a client
 * component goes through it, so it is also the single place to confirm that no
 * hash, secret, or token is being serialized to the browser.
 */
import type { ProduceListing } from './mock-data';

export function num(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return typeof value === 'string' ? value : '';
}

export interface ListingRow {
  id: string;
  farmer_id: string;
  title: string;
  description: string | null;
  category: string;
  produce_type: string;
  quantity_kg: string | number;
  quantity_unit: string;
  price_per_unit: string | number;
  currency: string;
  min_order_qty: string | number;
  harvest_date: Date | string | null;
  available_from: Date | string;
  available_until: Date | string | null;
  photos: string[] | null;
  is_organic: boolean;
  is_available: boolean;
  province: string;
  district: string;
  delivery_options: string[] | null;
  views_count: number;
  status: ProduceListing['status'];
  created_at: Date | string;
}

/** Converts a listings row into the ProduceListing shape used by the UI. */
export function toListing(row: ListingRow): ProduceListing {
  return {
    id: row.id,
    farmer_id: row.farmer_id,
    title: row.title,
    description: row.description ?? undefined,
    category: row.category,
    produce_type: row.produce_type,
    quantity_kg: num(row.quantity_kg),
    quantity_unit: row.quantity_unit,
    price_per_unit: num(row.price_per_unit),
    currency: row.currency,
    min_order_qty: num(row.min_order_qty),
    harvest_date: row.harvest_date ? iso(row.harvest_date).slice(0, 10) : undefined,
    available_from: iso(row.available_from).slice(0, 10),
    available_until: row.available_until ? iso(row.available_until).slice(0, 10) : undefined,
    photos: row.photos ?? [],
    is_organic: row.is_organic,
    is_available: row.is_available,
    province: row.province,
    district: row.district,
    delivery_options: row.delivery_options ?? [],
    views_count: row.views_count,
    status: row.status,
    created_at: iso(row.created_at),
  };
}

