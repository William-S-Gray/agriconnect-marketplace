import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { sql } from '@/lib/db';
import { requireRole, canModifyListing } from '@/lib/rbac';
import { verifyOrigin, csrfFailure } from '@/lib/csrf';
import { readJson } from '@/lib/http';
import { logError } from '@/lib/log';
import {
  MAX_PHOTOS, MAX_PHOTO_BYTES, PHOTO_TYPES, isUuid, photoPrefix, photosEnabled,
} from '@/lib/listing-photos';

export const runtime = 'nodejs';

/**
 * Issues a one-off upload token for a photo of one of the caller's listings.
 * The token is bound to that listing's path, to image types and to a size
 * cap; Blob enforces those, not the browser. Only token requests are
 * accepted: completion is reported through /api/farmer/listings/photos.
 */
export async function POST(request: Request) {
  const csrf = await verifyOrigin('POST');
  if (!csrf.ok) return csrfFailure();
  if (!photosEnabled()) {
    return NextResponse.json({ error: 'Photo uploads are not available.', code: 'photos_disabled' }, { status: 503 });
  }

  const auth = await requireRole('farmer');
  if (!auth.ok) return auth.response;

  const read = await readJson(request);
  if (!read.ok) return read.response;
  const body = read.data as HandleUploadBody;
  const listingId = body?.type === 'blob.generate-client-token' ? body.payload?.clientPayload : null;
  if (!isUuid(listingId)) {
    return NextResponse.json({ error: 'Invalid request.', code: 'bad_request' }, { status: 400 });
  }
  if (!(await canModifyListing(auth.user, listingId))) {
    return NextResponse.json({ error: 'Not your listing.', code: 'forbidden' }, { status: 403 });
  }
  const [row] = await sql<{ n: number }>`SELECT cardinality(photos) AS n FROM listings WHERE id = ${listingId}`;
  if ((row?.n ?? 0) >= MAX_PHOTOS) {
    return NextResponse.json({ error: `A listing can have up to ${MAX_PHOTOS} photos.`, code: 'too_many' }, { status: 400 });
  }

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(photoPrefix(listingId))) throw new Error('pathname outside listing');
        return {
          allowedContentTypes: PHOTO_TYPES,
          maximumSizeInBytes: MAX_PHOTO_BYTES,
          addRandomSuffix: true,
          validUntil: Date.now() + 10 * 60_000,
        };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    logError('photo_token_failed', error, { listingId });
    return NextResponse.json({ error: 'Could not start the upload.', code: 'upload_refused' }, { status: 400 });
  }
}
