import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { MAX_UPLOAD_BODY_BYTES } from '@/lib/images/picture-rules';
import { nodeDetailSchema, partPictureSchema } from '@/server/views/schemas';

import { defined } from '../support/defined';
import { jpegOfSize, PLAIN_TEXT, pngOfSize, SVG_TEXT, smallGif, smallJpeg, smallWebp, uploadForm } from '../support/pictures';
import { harness, holdSessionClock, releaseSessionClock } from '../support/session-harness';

/**
 * STORY-05.07 T5 (AC-1, AC-2, AC-5, AC-6, AC-7; NFR-005), through the real `withRoute`, the real session and the real estimate service over in-memory storage: the upload is one
 * multipart file read within a hard cap, each refusal answers its status, the picture is served with the stored type and the fixed headers and only to the people who may open its
 * estimate. Who may call is `tests/security`; the immutable table and the lock are `tests/integration/estimates/image.test.ts`. Every name, ID and file is invented.
 */

vi.mock('next-auth', async () => ({ getServerSession: (await import('../support/session-harness')).harness.getServerSession }));
vi.mock('next/headers', async () => ({ headers: (await import('../support/session-harness')).harness.headers }));
vi.mock('next/navigation', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return { redirect: shared.redirect, forbidden: shared.forbidden, notFound: shared.notFound };
});
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T): T => fn }));
vi.mock('@/server/composition', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return { getAuthOptions: () => ({}), getUserRepository: () => shared.users, getEstimateService: () => shared.estimateService };
});

const ORIGIN = 'https://portal.example.test';
const UNKNOWN_ID = '00000000-0000-4000-8000-00000000dead';
const KB = 1024;
const { PUT: putImage, DELETE: deleteImage } = await import('@/app/api/v1/estimates/[id]/nodes/[nodeId]/image/route');
const { GET: getImage } = await import('@/app/api/v1/images/[id]/route');
const { GET: getNode } = await import('@/app/api/v1/estimates/[id]/nodes/[nodeId]/route');

const record = z.record(z.string(), z.unknown());
const estimate = () => defined(harness.estimateWorld.estimates[0]);
const owned = (): string => estimate().id;
const canaryPart = (): string => owned();
const stored = () => defined(harness.estimateWorld.nodes[0]);
const CANARY_IMAGE = defined(harness.estimateWorld.images[0]);
const imagePath = (id = owned(), nodeId = canaryPart()): string => `/api/v1/estimates/${id}/nodes/${nodeId}/image`;
const forNode = (id: string, nodeId: string) => ({ params: Promise.resolve({ id, nodeId }) });
const forImage = (id: string) => ({ params: Promise.resolve({ id }) });

interface StreamingInit extends RequestInit {
  duplex: 'half';
}

/**
 * The form as bytes on the wire, with its boundary in the content type, as a browser's request arrives at the server. (A body that stays a `FormData` is a stream the platform
 * pumps itself, and cancelling it half-way, which the cap does on purpose, makes the platform's own pump throw after the fact.)
 */
async function upload(form: FormData | null, extra: Record<string, string> = {}, path = imagePath(), id = owned(), nodeId = canaryPart()): Promise<Response> {
  const encoded = form === null ? null : new Response(form);
  const type = encoded?.headers.get('content-type');
  const body = encoded === null ? undefined : new Uint8Array(await encoded.arrayBuffer());
  const headers = { origin: ORIGIN, ...(type === null || type === undefined ? {} : { 'content-type': type }), ...extra };
  return putImage(new Request(`${ORIGIN}${path}`, { method: 'PUT', headers, ...(body === undefined ? {} : { body }) }), forNode(id, nodeId));
}

/** A picture no part of the harness holds (the canary picture is `fresh()`, so the same bytes would be found, not stored). */
const fresh = (): Buffer => pngOfSize(120);

const send = (bytes: Uint8Array, name = 'cabinet-photo.png', extra: Record<string, string> = {}): Promise<Response> => upload(uploadForm(bytes, name), extra);
const remove = (id = owned(), nodeId = canaryPart()): Promise<Response> => deleteImage(new Request(`${ORIGIN}${imagePath(id, nodeId)}`, { method: 'DELETE', headers: { origin: ORIGIN } }), forNode(id, nodeId));
const fetchImage = (id: string): Promise<Response> => getImage(new Request(`${ORIGIN}/api/v1/images/${id}`, { method: 'GET', headers: { origin: ORIGIN } }), forImage(id));

/** The one member of a problem body that differs between two calls. */
const withoutRequestId = (body: unknown): Record<string, unknown> => ({ ...record.parse(body), requestId: undefined });

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  harness.signInAs('ENGINEER');
});

/** Puts the harness estimate, its one part and its one picture back as the recipe made them, whatever a test did. */
afterEach(() => {
  const held = estimate();
  held.status = 'DRAFT';
  held.inputsRevision = 0;
  held.engineerId = harness.idOf.ENGINEER;
  harness.estimateWorld.nodes.splice(0, harness.estimateWorld.nodes.length, { id: held.id, estimateId: held.id, parentId: null, sortIndex: 0, revision: 1, inputs: {} });
  harness.estimateWorld.images.splice(0, harness.estimateWorld.images.length, CANARY_IMAGE);
});

describe('AC-1, AC-4: PUT and DELETE /estimates/{id}/nodes/{nodeId}/image', () => {
  it('adds a picture: 200 with the part and its picture, one strict shape, and no bytes', async () => {
    const response = await send(fresh());
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const body = partPictureSchema.parse(await response.json());
    expect(body).toEqual({ id: canaryPart(), revision: 2, completeness: 'EMPTY', picture: { id: expect.any(String) as string, fileName: 'cabinet-photo.png', sizeBytes: fresh().length } });
    expect(stored().imageId).toBe(body.picture?.id);
    expect(estimate().inputsRevision).toBe(1);
  });

  it('answers the same for a Lead and an Admin', async () => {
    for (const role of ['LEAD', 'ADMIN'] as const) {
      harness.signInAs(role);
      expect((await send(fresh(), `${role}.png`)).status).toBe(200);
    }
  });

  it('removes it: 200 with no picture, and the part reads as having none', async () => {
    await send(fresh());
    const response = await remove();
    expect(response.status).toBe(200);
    expect(partPictureSchema.parse(await response.json())).toEqual({ id: canaryPart(), revision: 3, completeness: 'EMPTY', picture: null });
    expect(stored().imageId).toBeNull();
  });

  it('shows the picture on the part (GET /nodes/{nodeId}): its ID, sanitised name and size, and null when there is none', async () => {
    expect(nodeDetailSchema.parse(await (await getNode(new Request(`${ORIGIN}/x`, { headers: { origin: ORIGIN } }), forNode(owned(), canaryPart()))).json()).picture).toBeNull();
    const added = partPictureSchema.parse(await (await send(fresh(), '<b>front.png')).json());
    const detail = nodeDetailSchema.parse(await (await getNode(new Request(`${ORIGIN}/x`, { headers: { origin: ORIGIN } }), forNode(owned(), canaryPart()))).json());
    expect(detail.picture).toEqual({ id: added.picture?.id, fileName: 'bfront.png', sizeBytes: fresh().length });
  });
});

describe('AC-2: what is refused, and nothing is stored', () => {
  it('accepts 199 KB and refuses 201 KB and 204,800 bytes with 413 and the SCR-05 words', async () => {
    expect((await send(pngOfSize(199 * KB))).status).toBe(200);
    harness.estimateWorld.images.splice(0, harness.estimateWorld.images.length, CANARY_IMAGE);
    for (const [size, kilobytes] of [
      [201 * KB, 201],
      [204_800, 200],
    ] as const) {
      const response = await send(pngOfSize(size), 'cabinet-photo.png');
      expect(response.status).toBe(413);
      expect(response.headers.get('content-type')).toBe('application/problem+json');
      expect(record.parse(await response.json())).toMatchObject({
        status: 413,
        code: 'PICTURE_TOO_LARGE',
        title: `"cabinet-photo.png" is ${String(kilobytes)} KB. Pictures must be under 200 KB. Choose a smaller picture.`,
      });
    }
  });

  it('refuses a text file renamed .png, an SVG, an empty file and a WebP the browser did not convert with 415 and the SCR-05 words', async () => {
    for (const bytes of [PLAIN_TEXT, SVG_TEXT, Buffer.alloc(0), smallWebp()]) {
      const response = await send(bytes, 'photo.png');
      expect(response.status).toBe(415);
      expect(record.parse(await response.json())).toMatchObject({ status: 415, code: 'PICTURE_TYPE_REFUSED', title: 'Only PNG, JPG, GIF or WebP pictures are accepted.' });
    }
    expect(harness.estimateWorld.images).toEqual([CANARY_IMAGE]);
    expect(stored().imageId ?? null).toBeNull();
    expect(stored().revision).toBe(1);
  });

  it('does not take the type from the declared Content-Type: a PNG declared as text is a PNG, and a text file declared as image/png is refused', async () => {
    expect((await upload(uploadForm(fresh(), 'a.png', 'text/plain'))).status).toBe(200);
    expect((await upload(uploadForm(PLAIN_TEXT, 'a.png', 'image/png'))).status).toBe(415);
  });
});

describe('the body is read within a hard cap (NFR-005, "Careful")', () => {
  it('refuses a body over 256 KB with 413 and stores nothing, with no Content-Length', async () => {
    const response = await send(pngOfSize(MAX_UPLOAD_BODY_BYTES + 1000));
    expect(response.status).toBe(413);
    expect(record.parse(await response.json())).toMatchObject({ code: 'PICTURE_TOO_LARGE', title: 'Pictures must be under 200 KB. Choose a smaller picture.' });
    expect(harness.estimateWorld.images).toEqual([CANARY_IMAGE]);
  });

  it('refuses it by Content-Length without reading a byte, and when the Content-Length is a lie', async () => {
    const huge = pngOfSize(MAX_UPLOAD_BODY_BYTES + 1000);
    expect((await send(huge, 'a.png', { 'content-length': String(huge.length) })).status).toBe(413);
    // The header says 100 bytes; the body is over the cap: the bytes that arrive are counted, not the header.
    expect((await send(huge, 'a.png', { 'content-length': '100' })).status).toBe(413);
  });

  it('stops reading a stream the moment the cap is passed', async () => {
    const chunk = new Uint8Array(16 * KB).fill(97);
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          pulled += chunk.byteLength;
          controller.enqueue(chunk);
        },
      },
      { highWaterMark: 0 },
    );
    const init: StreamingInit = { method: 'PUT', headers: { origin: ORIGIN, 'content-type': 'multipart/form-data; boundary=x' }, body: stream, duplex: 'half' };
    const response = await putImage(new Request(`${ORIGIN}${imagePath()}`, init), forNode(owned(), canaryPart()));
    expect(response.status).toBe(413);
    // An endless stream was read to the cap and one chunk more, and then cancelled.
    expect(pulled).toBeLessThanOrEqual(MAX_UPLOAD_BODY_BYTES + chunk.byteLength);
  });

  it('accepts a picture just under the limit inside a body under the cap', async () => {
    const response = await send(pngOfSize(204_799));
    expect(response.status).toBe(200);
  });

  it('answers 400 for a body that is not one multipart file: JSON, no body, a second field, the file under another name', async () => {
    const json = await putImage(new Request(`${ORIGIN}${imagePath()}`, { method: 'PUT', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: '{"file":"x"}' }), forNode(owned(), canaryPart()));
    expect(json.status).toBe(400);
    expect((await upload(null)).status).toBe(400);
    const two = uploadForm(fresh());
    two.append('note', 'x');
    expect((await upload(two)).status).toBe(400);
    expect((await upload(uploadForm(fresh(), 'a.png', 'image/png', 'picture'))).status).toBe(400);
    expect(record.parse(await (await upload(null)).json())).toMatchObject({ status: 400, code: 'MALFORMED_REQUEST' });
  });
});

describe('AC-6: 404, 409 and the order of the refusals', () => {
  it('answers a stranger and an unknown estimate or part with the same 404, apart from the request ID', async () => {
    estimate().engineerId = harness.idOf.LEAD;
    const stranger = await send(fresh());
    const unknownEstimate = await upload(uploadForm(fresh()), {}, imagePath(UNKNOWN_ID), UNKNOWN_ID);
    harness.estimateWorld.estimates[0] = { ...estimate(), engineerId: harness.idOf.ENGINEER };
    const unknownPart = await upload(uploadForm(fresh()), {}, imagePath(owned(), UNKNOWN_ID), owned(), UNKNOWN_ID);
    for (const response of [stranger, unknownEstimate, unknownPart]) expect(response.status).toBe(404);
    expect(withoutRequestId(await stranger.json())).toEqual(withoutRequestId(await unknownEstimate.json()));
    expect(withoutRequestId(await unknownPart.json())).toMatchObject({ status: 404 });
  });

  it('answers 409 to an Engineer on a submitted estimate, and to everyone on an approved one, and stores nothing', async () => {
    estimate().status = 'SUBMITTED';
    const submitted = await send(fresh());
    expect(submitted.status).toBe(409);
    expect(record.parse(await submitted.json())).toMatchObject({ code: 'ESTIMATE_NOT_EDITABLE' });
    expect((await remove()).status).toBe(409);
    harness.signInAs('LEAD');
    expect((await send(fresh())).status).toBe(200);
    estimate().status = 'APPROVED';
    for (const role of ['ENGINEER', 'LEAD', 'ADMIN'] as const) {
      harness.signInAs(role);
      expect((await send(jpegOfSize(2000), `${role}.jpg`)).status, role).toBe(409);
    }
  });

  it('tells a stranger nothing about a wrong file: 404 before 415 and before 413', async () => {
    estimate().engineerId = harness.idOf.LEAD;
    expect((await send(PLAIN_TEXT)).status).toBe(404);
    expect((await send(pngOfSize(201 * KB))).status).toBe(404);
  });

  it('answers 401 signed out, before the body is read', async () => {
    harness.signInAs(null);
    expect((await send(fresh())).status).toBe(401);
    expect((await remove()).status).toBe(401);
  });

  it('refuses a request that did not come from the portal (CSRF) before anything else', async () => {
    const response = await putImage(new Request(`${ORIGIN}${imagePath()}`, { method: 'PUT', headers: { origin: 'https://other.example.test' }, body: uploadForm(fresh()) }), forNode(owned(), canaryPart()));
    expect(response.status).toBe(403);
    expect(record.parse(await response.json())).toMatchObject({ code: 'ORIGIN_REFUSED' });
    expect(stored().imageId ?? null).toBeNull();
  });
});

describe('AC-5: GET /images/{id}', () => {
  async function addedPicture(bytes: Uint8Array = fresh(), name = 'front.png'): Promise<string> {
    return defined(partPictureSchema.parse(await (await send(bytes, name)).json()).picture).id;
  }

  it('serves the stored bytes with the stored type and the fixed headers, to the owning Engineer, a Lead and an Admin', async () => {
    const id = await addedPicture();
    for (const role of ['ENGINEER', 'LEAD', 'ADMIN'] as const) {
      harness.signInAs(role);
      const response = await fetchImage(id);
      expect(response.status, role).toBe(200);
      expect(response.headers.get('content-type')).toBe('image/png');
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      expect(response.headers.get('content-disposition')).toBe('inline');
      expect(response.headers.get('content-security-policy')).toBe("default-src 'none'; sandbox");
      expect(response.headers.get('cross-origin-resource-policy')).toBe('same-origin');
      expect(response.headers.get('content-length')).toBe(String(fresh().length));
      expect(response.headers.get('x-request-id')).toMatch(/^req-[0-9a-f]{8}$/);
      expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([...fresh()]);
    }
  });

  it.each([
    ['PNG', fresh(), 'image/png'],
    ['JPEG', smallJpeg(), 'image/jpeg'],
    ['GIF', smallGif(), 'image/gif'],
  ] as const)('serves a %s with its own type', async (_name, bytes, mime) => {
    const id = await addedPicture(bytes, 'file.bin');
    expect((await fetchImage(id)).headers.get('content-type')).toBe(mime);
  });

  it('puts no file name in any header: a hostile stored name changes nothing', async () => {
    const id = await addedPicture(fresh(), '"; filename=evil.html\r\nX-Injected: 1.png');
    const response = await fetchImage(id);
    expect(response.headers.get('content-disposition')).toBe('inline');
    expect(response.headers.get('x-injected')).toBeNull();
    expect(JSON.stringify([...response.headers])).not.toContain('evil');
  });

  it('answers 401 signed out', async () => {
    const id = await addedPicture();
    harness.signInAs(null);
    expect((await fetchImage(id)).status).toBe(401);
  });

  it('answers another Engineer, an unknown ID and an ID that is not one with the same 404 and no picture', async () => {
    const id = await addedPicture();
    estimate().engineerId = harness.idOf.LEAD;
    const answers = [await fetchImage(id), await fetchImage(UNKNOWN_ID), await fetchImage('not-an-id'), await fetchImage('../../etc/passwd')];
    for (const answer of answers) {
      expect(answer.status).toBe(404);
      expect(answer.headers.get('content-type')).toBe('application/problem+json');
    }
    const bodies = await Promise.all(answers.map(async (answer) => JSON.stringify(withoutRequestId(await answer.json()))));
    expect(new Set(bodies).size).toBe(1);
  });

  it('serves the picture of an estimate that is submitted or approved (a read is not a change)', async () => {
    const id = await addedPicture();
    for (const status of ['SUBMITTED', 'APPROVED'] as const) {
      estimate().status = status;
      expect((await fetchImage(id)).status).toBe(200);
    }
  });

  it('still serves a picture that was replaced: the row is kept, and the old estimate record may still show it', async () => {
    const first = await addedPicture(fresh(), 'first.png');
    await addedPicture(smallJpeg(), 'second.jpg');
    expect((await fetchImage(first)).status).toBe(200);
  });
});
