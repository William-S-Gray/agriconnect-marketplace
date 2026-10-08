import { ImageResponse } from 'next/og';
import { listingSummary } from '@/lib/listing-summary';

export const alt = 'Produce listing on AgriConnect';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** The card WhatsApp, Facebook and X show when a listing link is shared. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const listing = await listingSummary((await params).id);
  const title = listing?.title ?? 'Fresh produce from Zimbabwe’s farms';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', padding: 72,
          background: '#f7f8f5', color: '#18181f', fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 32, fontWeight: 700, color: '#2d6a4f' }}>AgriConnect</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 64, fontWeight: 700, lineHeight: 1.1 }}>
            {title.length > 70 ? `${title.slice(0, 69)}…` : title}
          </div>
          {listing && (
            <div style={{ display: 'flex', fontSize: 52, fontWeight: 700, color: '#2d6a4f', marginTop: 24 }}>
              {listing.price}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', fontSize: 30, color: '#55606e' }}>
          {listing ? `${listing.farmName} · ${listing.place}` : 'Buy direct from verified farmers'}
        </div>
      </div>
    ),
    size,
  );
}
