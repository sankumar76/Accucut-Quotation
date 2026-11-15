import { PayloadTooLargeError } from '../../lib/errors';
import { PICTURE_TOO_LARGE_CODE, UPLOAD_TOO_LARGE_MESSAGE } from '../../lib/images/picture-rules';

/**
 * Reading one uploaded file with a **hard cap on the bytes read** (STORY-05.07 "Careful"; NFR-005; coding standards section 7 "stream large payloads"). `request.formData()` buffers
 * the whole body before anyone can look at it, so a huge upload would use up the process's memory first. So the body is read here, as a stream, and **reading stops the moment
 * more than `maxBytes` have arrived**: the rest is never taken from the connection (the stream is cancelled) and nothing is parsed. The `Content-Length` header is only a shortcut that
 * refuses an honest oversized upload before it starts; it is **never trusted**: a header that is missing, smaller than the truth or a lie changes nothing, because the stream is
 * counted anyway.
 *
 * Only what fits the cap is handed to the platform's multipart parser, from memory, so the parser's own buffering is bounded by the same number. The form must hold exactly one entry,
 * a file under the name `file`; anything else (a second field, a text under that name, a body that is not multipart) is "malformed". What the file is, and whether it is a picture, is
 * not decided here: that is `lib/images`, which reads its bytes.
 */

/** The name of the form field that carries the file. */
export const UPLOAD_FIELD = 'file';

/** The file as it was sent: its name as the browser gave it (not yet safe to show) and its bytes. */
export interface UploadedFile {
  readonly name: string;
  readonly bytes: Uint8Array;
}

/** The body is not one multipart upload of one file: not multipart, no boundary, cut short, another field, or no file. The wrapper answers 400. */
export class MalformedUploadError extends Error {
  constructor() {
    super('The upload is not one file in a multipart form.');
    this.name = 'MalformedUploadError';
  }
}

const MULTIPART_TYPE = /^multipart\/form-data\s*;/i;
const DIGITS_ONLY = /^\d{1,15}$/;

const tooLarge = (): PayloadTooLargeError => new PayloadTooLargeError(UPLOAD_TOO_LARGE_MESSAGE, { code: PICTURE_TOO_LARGE_CODE });

/** Joins the chunks that were read into one array of exactly `total` bytes. */
function joined(chunks: ReadonlyArray<Uint8Array>, total: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  return bytes;
}

/**
 * Reads a body as a stream and stops, with a 413, as soon as more than `maxBytes` bytes have arrived. The stream is cancelled, so the remainder is not read. A request with no body
 * is read as empty.
 */
export async function readBodyWithin(body: ReadableStream<Uint8Array> | null, maxBytes: number): Promise<Uint8Array<ArrayBuffer>> {
  if (body === null) return new Uint8Array(0);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      // The rest is not wanted: cancelling tells the sender's end to stop, and nothing more is held.
      await reader.cancel().catch(() => undefined);
      throw tooLarge();
    }
    chunks.push(value);
  }
  return joined(chunks, total);
}

/** The declared length, when there is one: a header that is not a plain number is malformed, one over the cap is refused before a byte is read. */
function checkDeclaredLength(request: Request, maxBytes: number): void {
  const declared = request.headers.get('content-length');
  if (declared === null) return;
  if (!DIGITS_ONLY.test(declared.trim())) throw new MalformedUploadError();
  if (Number(declared) > maxBytes) throw tooLarge();
}

/** The one file of a multipart form, or `MalformedUploadError`. */
async function fileOf(bytes: Uint8Array<ArrayBuffer>, contentType: string): Promise<UploadedFile> {
  let entries: Array<[string, FormDataEntryValue]>;
  try {
    entries = [...(await new Response(bytes, { headers: { 'content-type': contentType } }).formData()).entries()];
  } catch {
    throw new MalformedUploadError();
  }
  const [only] = entries;
  if (entries.length !== 1 || only === undefined || only[0] !== UPLOAD_FIELD || typeof only[1] === 'string') throw new MalformedUploadError();
  return { name: only[1].name, bytes: new Uint8Array(await only[1].arrayBuffer()) };
}

/**
 * The one file of a multipart request, read within `maxBodyBytes` (the whole body, the framing included). Throws `PayloadTooLargeError` (413) over the cap and
 * `MalformedUploadError` for a body that is not one file.
 */
export async function readUpload(request: Request, maxBodyBytes: number): Promise<UploadedFile> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!MULTIPART_TYPE.test(contentType)) throw new MalformedUploadError();
  checkDeclaredLength(request, maxBodyBytes);
  return fileOf(await readBodyWithin(request.body, maxBodyBytes), contentType);
}
