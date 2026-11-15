import { describe, expect, it } from 'vitest';

import { PayloadTooLargeError } from '@/lib/errors';
import { MalformedUploadError, readBodyWithin, readUpload, UPLOAD_FIELD } from '@/server/http/upload';

import { blobOf, pngOfSize, smallPng, uploadForm } from '../support/pictures';

/**
 * STORY-05.07 T3 (AC-2, AC-6, NFR-005; "Careful"): the upload is read with a hard cap **before** it is parsed. The cap is enforced on the bytes that really arrive, never on the
 * `Content-Length` header alone: a header that is missing, too small or a lie changes nothing, and reading stops (the stream is cancelled) the moment the cap is passed, so a huge
 * body is never held. Every file is built from invented bytes.
 */

const CAP = 256 * 1024;
const URL_OF_ROUTE = 'https://portal.example.test/api/v1/estimates/x/nodes/y/image';

interface StreamingInit extends RequestInit {
  duplex: 'half';
}

/** The body and content type of a form, as a browser would send them. */
async function encoded(form: FormData): Promise<{ readonly bytes: Uint8Array; readonly type: string }> {
  const response = new Response(form);
  return { bytes: new Uint8Array(await response.arrayBuffer()), type: response.headers.get('content-type') ?? '' };
}

/** A stream of `chunks`, counting how many bytes were pulled from it and whether it was cancelled. */
function countingStream(chunks: ReadonlyArray<Uint8Array>): { readonly stream: ReadableStream<Uint8Array>; readonly pulled: () => number; readonly cancelled: () => boolean } {
  let at = 0;
  let pulledBytes = 0;
  let wasCancelled = false;
  // A high-water mark of 0: nothing is pulled until a reader asks, so `pulled` is what the reader took.
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        const chunk = chunks[at];
        at += 1;
        if (chunk === undefined) controller.close();
        else {
          pulledBytes += chunk.byteLength;
          controller.enqueue(chunk);
        }
      },
      cancel() {
        wasCancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  return { stream, pulled: () => pulledBytes, cancelled: () => wasCancelled };
}

const streamed = (stream: ReadableStream<Uint8Array>, headers: Record<string, string>): Request => {
  const init: StreamingInit = { method: 'PUT', headers, body: stream, duplex: 'half' };
  return new Request(URL_OF_ROUTE, init);
};

async function requestOf(form: FormData, extra: Record<string, string> = {}): Promise<Request> {
  const { bytes, type } = await encoded(form);
  const init: StreamingInit = { method: 'PUT', headers: { 'content-type': type, ...extra }, body: blobOf(bytes).stream(), duplex: 'half' };
  return new Request(URL_OF_ROUTE, init);
}

describe('reading one file', () => {
  it('reads the file with its name and its bytes', async () => {
    const png = smallPng();
    const file = await readUpload(await requestOf(uploadForm(png, 'invented-front.png')), CAP);
    expect(file.name).toBe('invented-front.png');
    expect([...file.bytes]).toEqual([...png]);
  });

  it('reads a body of exactly the cap and refuses one byte more (the cap counts the whole body, the framing included)', async () => {
    const { bytes } = await encoded(uploadForm(pngOfSize(200_000)));
    const exact = await readBodyWithin(blobOf(bytes).stream(), bytes.length);
    expect(exact.length).toBe(bytes.length);
    await expect(readBodyWithin(blobOf(bytes).stream(), bytes.length - 1)).rejects.toBeInstanceOf(PayloadTooLargeError);
  });

  it('reads a request with no body as empty', async () => {
    expect((await readBodyWithin(null, CAP)).length).toBe(0);
  });
});

describe('the cap is enforced on the bytes that arrive (AC-2, AC-6)', () => {
  it('refuses an honest oversized upload by its Content-Length before reading a byte', async () => {
    const chunk = new Uint8Array(1024).fill(97);
    const counted = countingStream(Array.from({ length: 1000 }, () => chunk));
    const request = streamed(counted.stream, { 'content-type': 'multipart/form-data; boundary=x', 'content-length': String(1000 * 1024) });
    const error: unknown = await readUpload(request, CAP).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(PayloadTooLargeError);
    expect(counted.pulled()).toBe(0);
  });

  it('stops reading when more than the cap has arrived, whatever the Content-Length says: a body with no length', async () => {
    const chunk = new Uint8Array(16 * 1024).fill(97);
    const counted = countingStream(Array.from({ length: 4000 }, () => chunk));
    const request = streamed(counted.stream, { 'content-type': 'multipart/form-data; boundary=x' });
    const error: unknown = await readUpload(request, CAP).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(PayloadTooLargeError);
    expect(error).toMatchObject({ httpStatus: 413, code: 'PICTURE_TOO_LARGE' });
    // The cap is 16 chunks; the one that crossed it is the last one read, and the other 3,983 chunks were never taken.
    expect(counted.pulled()).toBeLessThanOrEqual(CAP + chunk.byteLength);
    expect(counted.cancelled()).toBe(true);
  });

  it('stops reading when the Content-Length is a lie (says 100 bytes, sends megabytes)', async () => {
    const chunk = new Uint8Array(16 * 1024).fill(97);
    const counted = countingStream(Array.from({ length: 4000 }, () => chunk));
    const request = streamed(counted.stream, { 'content-type': 'multipart/form-data; boundary=x', 'content-length': '100' });
    await expect(readUpload(request, CAP)).rejects.toBeInstanceOf(PayloadTooLargeError);
    expect(counted.pulled()).toBeLessThanOrEqual(CAP + chunk.byteLength);
    expect(counted.cancelled()).toBe(true);
  });

  it('does not parse what it refuses: an oversized body is a 413 even when it is not multipart inside', async () => {
    const counted = countingStream([new Uint8Array(CAP + 1).fill(0)]);
    await expect(readBodyWithin(counted.stream, CAP)).rejects.toBeInstanceOf(PayloadTooLargeError);
  });
});

describe('a body that is not one file is malformed (400)', () => {
  const refused = async (request: Request): Promise<unknown> => readUpload(request, CAP).catch((caught: unknown) => caught);

  it('is refused when the content type is not multipart', async () => {
    const init: StreamingInit = { method: 'PUT', headers: { 'content-type': 'application/json' }, body: new Blob(['{}']).stream(), duplex: 'half' };
    expect(await refused(new Request(URL_OF_ROUTE, init))).toBeInstanceOf(MalformedUploadError);
    const none: StreamingInit = { method: 'PUT', body: blobOf(smallPng()).stream(), duplex: 'half' };
    expect(await refused(new Request(URL_OF_ROUTE, none))).toBeInstanceOf(MalformedUploadError);
  });

  it('is refused when the boundary is missing or the body is not a multipart form', async () => {
    const noBoundary: StreamingInit = { method: 'PUT', headers: { 'content-type': 'multipart/form-data' }, body: new Blob(['abc']).stream(), duplex: 'half' };
    expect(await refused(new Request(URL_OF_ROUTE, noBoundary))).toBeInstanceOf(MalformedUploadError);
    const garbage: StreamingInit = { method: 'PUT', headers: { 'content-type': 'multipart/form-data; boundary=abc' }, body: new Blob(['not a form']).stream(), duplex: 'half' };
    expect(await refused(new Request(URL_OF_ROUTE, garbage))).toBeInstanceOf(MalformedUploadError);
  });

  it('is refused when the form has no file, a second field, or the file is under another name', async () => {
    const empty = new FormData();
    expect(await refused(await requestOf(empty))).toBeInstanceOf(MalformedUploadError);
    const two = uploadForm(smallPng());
    two.append('note', 'hello');
    expect(await refused(await requestOf(two))).toBeInstanceOf(MalformedUploadError);
    const twoFiles = uploadForm(smallPng());
    twoFiles.append(UPLOAD_FIELD, new File([blobOf(smallPng())], 'second.png'));
    expect(await refused(await requestOf(twoFiles))).toBeInstanceOf(MalformedUploadError);
    expect(await refused(await requestOf(uploadForm(smallPng(), 'a.png', 'image/png', 'picture')))).toBeInstanceOf(MalformedUploadError);
  });

  it('is refused when the field named file is plain text, not a file', async () => {
    const text = new FormData();
    text.append(UPLOAD_FIELD, 'just some text');
    expect(await refused(await requestOf(text))).toBeInstanceOf(MalformedUploadError);
  });

  it('is refused when the Content-Length is not a plain number', async () => {
    for (const bad of ['abc', '-5', '1e3', '1.5', '']) {
      expect(await refused(await requestOf(uploadForm(smallPng()), { 'content-length': bad })), JSON.stringify(bad)).toBeInstanceOf(MalformedUploadError);
    }
  });
});
