'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { upload } from '@vercel/blob/client';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const MAX_PHOTOS = 5;
const MAX_EDGE = 1600;

/**
 * Shrinks a phone photo (often 4000 px, several MB) to at most 1600 px JPEG
 * before upload: far less mobile data for the farmer, and faster pages for
 * buyers. Falls back to the original file if the browser cannot decode it.
 */
async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.82));
    return blob ?? file;
  } catch {
    return file;
  }
}

/** Photos for one listing. Every step is re-checked by the API. */
export function PhotoManager({ listingId, photos }: { listingId: string; photos: string[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function add(files: FileList | null) {
    const picked = [...(files ?? [])].slice(0, MAX_PHOTOS - photos.length);
    for (const file of picked) {
      setBusy('upload');
      try {
        const body = await shrink(file);
        const blob = await upload(`listings/${listingId}/photo.jpg`, body, {
          access: 'public',
          handleUploadUrl: '/api/farmer/listings/photos/token',
          clientPayload: listingId,
          contentType: body.type || file.type,
        });
        const res = await fetch('/api/farmer/listings/photos', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ listingId, url: blob.url }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? 'Could not add the photo.');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Upload failed.');
        break;
      }
    }
    setBusy(null);
    if (input.current) input.current.value = '';
    router.refresh();
  }

  async function remove(url: string) {
    setBusy(url);
    try {
      const res = await fetch('/api/farmer/listings/photos', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ listingId, url }),
      });
      if (!res.ok) toast.error('Could not remove the photo.');
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {photos.map((url) => (
        <div key={url} className="relative h-16 w-16 overflow-hidden rounded-md border border-border">
          <img src={url} alt="" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => remove(url)}
            disabled={busy !== null}
            aria-label="Remove photo"
            className="absolute right-0.5 top-0.5 rounded-full bg-background/90 p-0.5 text-foreground hover:bg-background"
          >
            {busy === url ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
          </button>
        </div>
      ))}
      {photos.length < MAX_PHOTOS && (
        <>
          <input
            ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
            onChange={(e) => add(e.target.files)}
          />
          <Button
            type="button" size="sm" variant="outline" className="h-16 w-16 flex-col gap-1 text-xs"
            disabled={busy !== null} onClick={() => input.current?.click()}
          >
            {busy === 'upload' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {busy === 'upload' ? 'Uploading' : 'Add photo'}
          </Button>
        </>
      )}
    </div>
  );
}
