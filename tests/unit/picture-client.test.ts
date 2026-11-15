import { describe, expect, it, vi } from 'vitest';

import { loadForm, loadPartInputs } from '@/lib/estimates/form-client';
import { dropPicture, pictureUrl, sendPicture } from '@/lib/estimates/picture-client';
import { toPictureView } from '@/lib/estimates/picture-view';

import { smallPng } from '../support/pictures';

/**
 * STORY-05.07 T7 (AC-1, AC-2, AC-6): the browser's side of the picture routes, with a fetch that answers for the server. The file goes as one multipart form under the name `file`,
 * the server's refusal words come back as they are, and a wrong-shaped answer is a failure and not a crash. Every name and ID is invented.
 */

const ESTIMATE = '00000000-0000-4000-8000-0000000000e1';
const PART = '00000000-0000-4000-8000-0000000000d1';
const PICTURE = '00000000-0000-4000-8000-0000000000f1';
const FIELD = '00000000-0000-4000-8000-000100000003';

const json = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' } });
const picture = { id: PICTURE, fileName: 'cabinet-photo.png', sizeBytes: 1234 };
const answer = (overrides: Record<string, unknown> = {}) => ({ id: PART, revision: 2, completeness: 'EMPTY', picture, ...overrides });
const file = (): File => new File([new Uint8Array(smallPng())], 'cabinet-photo.png', { type: 'image/png' });

describe('toPictureView', () => {
  it('reads an ID, a name and a size, and nothing else', () => {
    expect(toPictureView({ ...picture, extra: 1 })).toEqual(picture);
  });

  it.each([null, undefined, 'x', 5, {}, { ...picture, id: '' }, { ...picture, fileName: '' }, { ...picture, sizeBytes: '12' }, { id: PICTURE, fileName: 'a.png' }])('is null for %j', (value) => {
    expect(toPictureView(value)).toBeNull();
  });
});

describe('pictureUrl', () => {
  it('is the route that serves the picture, with the ID encoded', () => {
    expect(pictureUrl(PICTURE)).toBe(`/api/v1/images/${PICTURE}`);
    expect(pictureUrl('a/b?c')).toBe('/api/v1/images/a%2Fb%3Fc');
  });
});

describe('sendPicture', () => {
  it('sends PUT .../nodes/{nodeId}/image as one multipart form with the file under the name "file", and reads the part and its picture', async () => {
    const fetcher = vi.fn<typeof fetch>(() => Promise.resolve(json(200, answer())));
    const outcome = await sendPicture(ESTIMATE, PART, file(), fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [path, init] = fetcher.mock.calls[0] ?? [];
    expect(path).toBe(`/api/v1/estimates/${ESTIMATE}/nodes/${PART}/image`);
    expect(init).toMatchObject({ method: 'PUT', credentials: 'same-origin' });
    // The browser sets the content type with the boundary: a header here would break it.
    expect(JSON.stringify(init?.headers ?? {})).not.toMatch(/content-type/i);
    const body = init?.body;
    expect(body).toBeInstanceOf(FormData);
    const entries = body instanceof FormData ? [...body.entries()] : [];
    expect(entries.map(([name]) => name)).toEqual(['file']);
    expect(entries[0]?.[1]).toBeInstanceOf(File);
    expect(outcome).toEqual({ status: 'ok', value: { id: PART, revision: 2, completeness: 'EMPTY', picture } });
  });

  it.each([
    [413, 'PICTURE_TOO_LARGE', '"cabinet-photo.png" is 312 KB. Pictures must be under 200 KB. Choose a smaller picture.'],
    [415, 'PICTURE_TYPE_REFUSED', 'Only PNG, JPG, GIF or WebP pictures are accepted.'],
    [409, 'ESTIMATE_NOT_EDITABLE', 'This estimate can no longer be changed.'],
    [409, 'PART_CHANGED', 'This part was changed by someone else.'],
    [404, 'NOT_FOUND', 'Not found.'],
  ])('carries the server\'s words for a %i refusal (%s)', async (status, code, title) => {
    const outcome = await sendPicture(ESTIMATE, PART, file(), () => Promise.resolve(json(status, { type: 'about:blank', title, status, code, requestId: 'req-00000000' })));
    expect(outcome).toMatchObject({ status: 'refused', httpStatus: status, code, title });
  });

  it('is a failure, not a crash, for a lost connection, a server fault and an answer of the wrong shape', async () => {
    expect(await sendPicture(ESTIMATE, PART, file(), () => Promise.reject(new Error('offline')))).toEqual({ status: 'failed' });
    expect(await sendPicture(ESTIMATE, PART, file(), () => Promise.resolve(json(500, { title: 'x', code: 'INTERNAL_ERROR' })))).toEqual({ status: 'failed' });
    for (const wrong of [{}, { ...answer(), id: '' }, { ...answer(), revision: '2' }, { ...answer(), completeness: 'DONE' }, { ...answer(), picture: { id: PICTURE } }, { ...answer(), picture: undefined }]) {
      expect(await sendPicture(ESTIMATE, PART, file(), () => Promise.resolve(json(200, wrong))), JSON.stringify(wrong)).toEqual({ status: 'failed' });
    }
  });
});

describe('dropPicture', () => {
  it('sends DELETE .../image and reads the part with no picture', async () => {
    const fetcher = vi.fn<typeof fetch>(() => Promise.resolve(json(200, answer({ revision: 3, picture: null }))));
    const outcome = await dropPicture(ESTIMATE, PART, fetcher);
    expect(fetcher.mock.calls[0]?.[0]).toBe(`/api/v1/estimates/${ESTIMATE}/nodes/${PART}/image`);
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: 'DELETE' });
    expect(outcome).toEqual({ status: 'ok', value: { id: PART, revision: 3, completeness: 'EMPTY', picture: null } });
  });

  it('carries a refusal and is a failure for a lost connection', async () => {
    expect(await dropPicture(ESTIMATE, PART, () => Promise.resolve(json(409, { type: 'about:blank', title: 'This estimate can no longer be changed.', status: 409, code: 'ESTIMATE_NOT_EDITABLE', requestId: 'req-00000000' })))).toMatchObject({
      status: 'refused',
      httpStatus: 409,
    });
    expect(await dropPicture(ESTIMATE, PART, () => Promise.reject(new Error('offline')))).toEqual({ status: 'failed' });
  });
});

describe('the part form reads a picture and the picture rule', () => {
  const field = { id: FIELD, letter: 'C', label: 'Part Model', kind: 'input', unit: null, hint: 'PNG, JPG, GIF or WebP, under 200 KB.', defaultValue: null, required: false, editable: false, rule: { type: 'picture' } };
  const section = { id: '00000000-0000-4000-8000-000200000001', number: 1, name: 'Part Details', shortName: 'Part details', columnRange: 'A–D, G, H', fields: [field], reserved: [] };

  it('reads the picture rule of the form', async () => {
    const outcome = await loadForm(ESTIMATE, () => Promise.resolve(json(200, { sections: [section], lastSavedAt: null })));
    expect(outcome.status === 'ok' && outcome.value.sections[0]?.fields[0]).toMatchObject({ letter: 'C', required: false, editable: false, rule: { type: 'picture' } });
  });

  it('reads the picture of a part, and none as null', async () => {
    const part = { id: PART, parentId: null, slNo: '1', label: '', completeness: 'EMPTY', revision: 1, inputs: [] };
    const withPicture = await loadPartInputs(ESTIMATE, PART, () => Promise.resolve(json(200, { ...part, picture })));
    expect(withPicture.status === 'ok' && withPicture.value.picture).toEqual(picture);
    const none = await loadPartInputs(ESTIMATE, PART, () => Promise.resolve(json(200, { ...part, picture: null })));
    expect(none.status === 'ok' && none.value.picture).toBeNull();
  });

  it('hands the picture over as the server sent it, unread (the picture control reads it, so that code is not in the first load), and has none when the answer does not say (a save of values)', async () => {
    const part = { id: PART, revision: 2, completeness: 'PARTIAL', inputs: [] };
    const saved = await loadPartInputs(ESTIMATE, PART, () => Promise.resolve(json(200, part)));
    expect(saved.status === 'ok' && saved.value.picture).toBeUndefined();
    const odd = await loadPartInputs(ESTIMATE, PART, () => Promise.resolve(json(200, { ...part, picture: { id: 1 } })));
    expect(odd.status === 'ok' && odd.value.picture).toEqual({ id: 1 });
    // The control reads it, and a value that is not a picture is no picture.
    expect(toPictureView({ id: 1 })).toBeNull();
  });
});
