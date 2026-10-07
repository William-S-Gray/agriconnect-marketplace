import { NextResponse } from 'next/server';

/** Largest JSON body any route accepts. The biggest real one is a listing (~3 KB). */
export const MAX_JSON_BYTES = 64 * 1024;

type ReadResult = { ok: true; data: unknown } | { ok: false; response: NextResponse };

const fail = (status: number, error: string, code: string): ReadResult => ({
  ok: false,
  response: NextResponse.json({ error, code }, { status }),
});

/**
 * Reads a JSON request body, refusing anything else. Every route handler uses
 * this instead of request.json(), which
 *   - accepted any Content-Type, including the text/plain an HTML form can
 *     send cross-site (the "JSON bodies only" CSRF layer in lib/csrf.ts was
 *     only a claim until this enforced it), and
 *   - buffered a body of any size: a 20 MB request was read in full before
 *     validation rejected it.
 *
 * The size limit is enforced while streaming, so a missing or false
 * Content-Length does not get around it.
 */
export async function readJson(
  request: Request,
  opts: { optional?: boolean; maxBytes?: number } = {},
): Promise<ReadResult> {
  const max = opts.maxBytes ?? MAX_JSON_BYTES;
  const declared = Number(request.headers.get('content-length') ?? NaN);
  if (opts.optional && (declared === 0 || !request.body)) return { ok: true, data: {} };

  const type = request.headers.get('content-type') ?? '';
  if (!/^application\/json\b/i.test(type)) {
    if (opts.optional && !request.body) return { ok: true, data: {} };
    return fail(415, 'Send the request body as JSON.', 'unsupported_media_type');
  }
  if (Number.isFinite(declared) && declared > max) return fail(413, 'Request body is too large.', 'payload_too_large');

  const reader = request.body?.getReader();
  if (!reader) return opts.optional ? { ok: true, data: {} } : fail(400, 'Invalid request body.', 'bad_request');
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return fail(413, 'Request body is too large.', 'payload_too_large');
    }
    chunks.push(value);
  }
  const text = new TextDecoder().decode(Buffer.concat(chunks));
  if (opts.optional && text.trim() === '') return { ok: true, data: {} };
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return fail(400, 'Invalid request body.', 'bad_request');
  }
}
