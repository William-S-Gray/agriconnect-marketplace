import { NextResponse } from 'next/server';
import { z } from 'zod';
import { head, del } from '@vercel/blob';
import { sql } from '@/lib/db';
import { requireRole, canModifyListing } from '@/lib/rbac';
import { verifyOrigin, csrfFailure } from '@/lib/csrf';
import { readJson } from '@/lib/http';
import { logError } from '@/lib/log';
import { MAX_PHOTOS, PHOTO_TYPES, photoPrefix, photosEnabled } from '@/lib/listing-photos';

export const runtime = 'nodejs';

const schema = z.object({ listingId: z.string().uuid(), url: z.string().url().max(500) });

/** Everything after the origin check, which each handler does itself. */
async function authorise(request: Request) {
  if (!photosEnabled()) {
    return { response: NextResponse.json({ error: 'Photo uploads are not available.', code: 'photos_disabled' }, { status: 503 }) };
  }
  const auth = await requireRole('farmer');
  if (!auth.ok) return { response: auth.response };
  const read = await readJson(request);
  if (!read.ok) return { response: read.response };
  const parsed = schema.safeParse(read.data);
  if (!parsed.success) {
    return { response: NextResponse.json({ error: 'Invalid request.', code: 'bad_request' }, { status: 400 }) };
  }
  if (!(await canModifyListing(auth.user, parsed.data.listingId))) {
    return { response: NextResponse.json({ error: 'Not your listing.', code: 'forbidden' }, { status: 403 }) };
  }
  return { data: parsed.data };
}

/**
 * Attaches an uploaded photo. The URL comes from the browser, so it is only
 * trusted after Blob confirms it exists in this store, under this listing's
 * path, as an image — a link to anywhere else is refused.
 */
export async function POST(request: Request) {
  const csrf = await verifyOrigin('POST');
  if (!csrf.ok) return csrfFailure();
  const a = await authorise(request);
  if (!a.data) return a.response;
  const { listingId, url } = a.data;

  let blob: Awaited<ReturnType<typeof head>>;
  try {
    blob = await head(url);
  } catch {
    return NextResponse.json({ error: 'That upload was not found.', code: 'not_found' }, { status: 400 });
  }
  if (!blob.pathname.startsWith(photoPrefix(listingId)) || !PHOTO_TYPES.includes(blob.contentType)) {
    return NextResponse.json({ error: 'That upload does not belong to this listing.', code: 'bad_blob' }, { status: 400 });
  }

  const [row] = await sql<{ photos: string[] }>`
    UPDATE listings SET photos = array_append(photos, ${blob.url}), updated_at = now()
     WHERE id = ${listingId} AND cardinality(photos) < ${MAX_PHOTOS} AND NOT (${blob.url} = ANY(photos))
     RETURNING photos`;
  if (!row) {
    return NextResponse.json({ error: `A listing can have up to ${MAX_PHOTOS} photos.`, code: 'too_many' }, { status: 400 });
  }
  return NextResponse.json({ photos: row.photos });
}

/** Detaches a photo and deletes the file. */
export async function DELETE(request: Request) {
  const csrf = await verifyOrigin('DELETE');
  if (!csrf.ok) return csrfFailure();
  const a = await authorise(request);
  if (!a.data) return a.response;
  const { listingId, url } = a.data;

  const [row] = await sql<{ photos: string[] }>`
    UPDATE listings SET photos = array_remove(photos, ${url}), updated_at = now()
     WHERE id = ${listingId} AND ${url} = ANY(photos)
     RETURNING photos`;
  if (!row) return NextResponse.json({ error: 'No such photo.', code: 'not_found' }, { status: 404 });

  // The listing no longer shows it either way; a leftover file only costs storage.
  await del(url).catch((error) => logError('photo_delete_failed', error, { listingId }));
  return NextResponse.json({ photos: row.photos });
}
