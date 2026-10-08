/**
 * Listing photos live in Vercel Blob. The browser uploads straight to Blob
 * with a short-lived token from /api/farmer/listings/photos/token (photos are
 * far larger than the API's 64 KB body limit), then attaches the result
 * through /api/farmer/listings/photos, which confirms the blob is really in
 * this store under that listing's path.
 *
 * Without BLOB_READ_WRITE_TOKEN (local development, CI) the feature is off:
 * the UI hides it and both routes answer 503.
 */
export const MAX_PHOTOS = 5;
export const PHOTO_TYPES = ['image/jpeg', 'image/webp', 'image/png'];
// The browser resizes to 1600 px before upload, which lands well under this.
export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

export const photosEnabled = (): boolean => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
export const photoPrefix = (listingId: string): string => `listings/${listingId}/`;
export const isUuid = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);
