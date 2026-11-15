import { describe, expect, it } from 'vitest';

import { ConflictError, NotFoundError, PayloadTooLargeError, UnsupportedMediaTypeError } from '@/lib/errors';
import { MAX_PICTURE_BYTES } from '@/lib/images/picture-rules';
import { createEstimateService, ESTIMATE_NOT_EDITABLE_CODE, type EstimateViewer } from '@/server/services/estimate-service';
import { sha256Of } from '@/server/services/image-service';

import { defined } from '../support/defined';
import { inputsDependencies } from '../support/estimate-inputs-deps';
import { createFakeEstimateWorld, type FakeEstimate, type FakeNode } from '../support/fake-estimates';
import { jpegOfSize, PLAIN_TEXT, pngOfSize, SCRIPT_TAIL, smallGif, smallJpeg, smallPng, smallWebp, SVG_TEXT } from '../support/pictures';

/**
 * STORY-05.07 T4 (AC-1, AC-2, AC-4, AC-6, AC-7, AC-5; D-31): adding, replacing, removing and reading a part's picture, over in-memory storage. Who may call is `tests/security`; the
 * real queries, the row lock and the immutable table are `tests/integration/estimates/image.test.ts`. Every name, ID and file here is invented.
 */

const ARJUN = '00000000-0000-4000-8000-0000000000a1';
const PRIYA = '00000000-0000-4000-8000-0000000000a2';
const LEAD = '00000000-0000-4000-8000-0000000000b1';
const ESTIMATE = '00000000-0000-4000-8000-0000000000e1';
const OTHER_ESTIMATE = '00000000-0000-4000-8000-0000000000e2';
const PART = '00000000-0000-4000-8000-0000000000d1';
const SECOND_PART = '00000000-0000-4000-8000-0000000000d2';
const OTHER_PART = '00000000-0000-4000-8000-0000000000d9';
const MISSING = '00000000-0000-4000-8000-0000000000ff';
const FOLDER = '\\\\invented-server\\invented-share\\RFQ-123';
const KB = 1024;

const estimate = (overrides: Partial<FakeEstimate> = {}): FakeEstimate => ({
  id: ESTIMATE,
  code: 'Q-2026-0318',
  engineerId: ARJUN,
  assignedByName: 'Kiran Bose',
  folderPath: FOLDER,
  deadlineAt: new Date('2026-11-12T11:30:00.000Z'),
  title: null,
  notes: null,
  status: 'DRAFT',
  customerId: null,
  inputsRevision: 0,
  ...overrides,
});

const node = (id: string, overrides: Partial<FakeNode> = {}): FakeNode => ({ id, estimateId: ESTIMATE, parentId: null, sortIndex: 0, revision: 1, inputs: {}, ...overrides });

const arjun: EstimateViewer = { id: ARJUN, role: 'ENGINEER' };
const priya: EstimateViewer = { id: PRIYA, role: 'ENGINEER' };
const lead: EstimateViewer = { id: LEAD, role: 'LEAD' };
const admin: EstimateViewer = { id: '00000000-0000-4000-8000-0000000000c1', role: 'ADMIN' };

function setUp(initial: ReadonlyArray<FakeEstimate> = [estimate()], nodes: ReadonlyArray<FakeNode> = [node(PART), node(SECOND_PART, { sortIndex: 1 })]) {
  const world = createFakeEstimateWorld(() => [], initial, nodes);
  const service = createEstimateService({ estimates: world.repository, nodes: world.nodeRepository, images: world.imageRepository, transactions: world.transactions, ...inputsDependencies() });
  const stored = (id = PART): FakeNode => defined(world.nodes.find((candidate) => candidate.id === id));
  const inputsRevision = (): number => defined(world.estimates.find((candidate) => candidate.id === ESTIMATE)).inputsRevision;
  const put = (bytes: Uint8Array, name = 'cabinet-photo.png', overrides: { viewer?: EstimateViewer; nodeId?: string; estimateId?: string } = {}) =>
    service.putPicture(overrides.viewer ?? arjun, overrides.estimateId ?? ESTIMATE, overrides.nodeId ?? PART, { name, bytes });
  const remove = (overrides: { viewer?: EstimateViewer; nodeId?: string } = {}) => service.removePicture(overrides.viewer ?? arjun, ESTIMATE, overrides.nodeId ?? PART);
  return { world, service, stored, inputsRevision, put, remove };
}

type SetUp = ReturnType<typeof setUp>;

/** Nothing was stored, the part and the estimate are as they were. */
function expectNothingChanged(setup: SetUp, part = PART): void {
  expect(setup.world.imageWrites()).toBe(0);
  expect(setup.world.images).toHaveLength(0);
  expect(setup.stored(part).imageId ?? null).toBeNull();
  expect(setup.stored(part).revision).toBe(1);
  expect(setup.inputsRevision()).toBe(0);
}

async function refusal(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
}

describe('AC-1, AC-4: a picture is added, replaced and removed', () => {
  it('stores a PNG, points the part at it, raises the part revision and the estimate inputs_revision by one, and answers with the picture and no bytes', async () => {
    const setup = setUp();
    const png = pngOfSize(199 * KB);
    const answer = await setup.put(png);
    const row = defined(setup.world.images[0]);
    expect(setup.world.images).toHaveLength(1);
    expect(row).toMatchObject({ estimateId: ESTIMATE, mime: 'image/png', fileName: 'cabinet-photo.png', sha256: sha256Of(png) });
    expect(row.bytes.byteLength).toBe(199 * KB);
    expect(setup.stored().imageId).toBe(row.id);
    expect(setup.stored().revision).toBe(2);
    expect(setup.inputsRevision()).toBe(1);
    expect(answer).toEqual({ id: PART, revision: 2, completeness: 'EMPTY', picture: { id: row.id, fileName: 'cabinet-photo.png', sizeBytes: 199 * KB } });
  });

  it.each([
    ['PNG', smallPng(), 'image/png'],
    ['JPEG', smallJpeg(), 'image/jpeg'],
    ['GIF', smallGif(), 'image/gif'],
    ['WebP', smallWebp(), 'image/webp'],
  ] as const)('stores a %s with the type its content has', async (_name, bytes, mime) => {
    const setup = setUp();
    await setup.put(bytes, 'whatever.bin');
    expect(defined(setup.world.images[0]).mime).toBe(mime);
  });

  it('judges the content and not the name or the declared type: a PNG called .txt is a PNG', async () => {
    const setup = setUp();
    await setup.put(smallPng(), 'notes.txt');
    expect(defined(setup.world.images[0]).mime).toBe('image/png');
  });

  it('stores the same file for the same part once and changes nothing the second time: no new row, no new revision, so a repeat cannot clear a total', async () => {
    const setup = setUp();
    const first = await setup.put(smallPng());
    const again = await setup.put(smallPng());
    expect(setup.world.imageWrites()).toBe(1);
    expect(setup.stored().revision).toBe(2);
    expect(setup.inputsRevision()).toBe(1);
    expect(again).toEqual(first);
  });

  it('replaces the picture with a new row, keeps the old one, and raises both revisions again', async () => {
    const setup = setUp();
    await setup.put(smallPng(), 'first.png');
    const first = defined(setup.world.images[0]);
    const answer = await setup.put(smallJpeg(), 'second.jpg');
    expect(setup.world.images).toHaveLength(2);
    expect(setup.world.images[0]).toBe(first);
    const second = defined(setup.world.images[1]);
    expect(setup.stored().imageId).toBe(second.id);
    expect(setup.stored().revision).toBe(3);
    expect(setup.inputsRevision()).toBe(2);
    expect(answer.picture).toEqual({ id: second.id, fileName: 'second.jpg', sizeBytes: second.bytes.byteLength });
  });

  it('puts the old picture back by adding its file again: the stored row is found, not stored twice', async () => {
    const setup = setUp();
    await setup.put(smallPng(), 'first.png');
    const first = defined(setup.world.images[0]);
    await setup.put(smallJpeg(), 'second.jpg');
    await setup.put(smallPng(), 'renamed.png');
    expect(setup.world.images).toHaveLength(2);
    expect(setup.stored().imageId).toBe(first.id);
  });

  it('removes the picture: the part points at none, both revisions rise, and the row stays', async () => {
    const setup = setUp();
    await setup.put(smallPng());
    const answer = await setup.remove();
    expect(answer).toEqual({ id: PART, revision: 3, completeness: 'EMPTY', picture: null });
    expect(setup.stored().imageId).toBeNull();
    expect(setup.inputsRevision()).toBe(2);
    expect(setup.world.images).toHaveLength(1);
  });

  it('removes a picture that is not there as a no-op: no write, no revision', async () => {
    const setup = setUp();
    const answer = await setup.remove();
    expect(answer).toEqual({ id: PART, revision: 1, completeness: 'EMPTY', picture: null });
    expectNothingChanged(setup);
  });
});

describe('D-31: the picture is optional', () => {
  it('a part with no picture reads as a whole part: no picture, no error, the completeness of its inputs alone', async () => {
    const setup = setUp([estimate()], [node(PART, { inputs: { 'invented-field': '1' } })]);
    const detail = await setup.service.getNode(arjun, ESTIMATE, PART);
    expect(detail.picture).toBeNull();
    expect(detail.completeness).toBe('PARTIAL');
  });

  it('a picture does not make an empty part "partial": it is not an input that is counted', async () => {
    const setup = setUp();
    await setup.put(smallPng());
    expect((await setup.service.getNode(arjun, ESTIMATE, PART)).completeness).toBe('EMPTY');
  });
});

describe('AC-2: a file is judged by its content and its size, and nothing is stored on a refusal', () => {
  it('accepts 199 KB and 204,799 bytes', async () => {
    const setup = setUp();
    await setup.put(pngOfSize(199 * KB));
    await setup.put(pngOfSize(MAX_PICTURE_BYTES - 1), 'edge.png');
    expect(setup.world.images.map((row) => row.bytes.byteLength)).toEqual([199 * KB, MAX_PICTURE_BYTES - 1]);
  });

  it.each([
    ['201 KB', pngOfSize(201 * KB), 201],
    ['204,800 bytes exactly', pngOfSize(MAX_PICTURE_BYTES), 200],
  ])('refuses %s as too large (413) in the words of SCR-05', async (_name, bytes, kilobytes) => {
    const setup = setUp();
    const error = await refusal(setup.put(bytes, 'cabinet-photo.png'));
    expect(error).toBeInstanceOf(PayloadTooLargeError);
    expect(error).toMatchObject({ httpStatus: 413, code: 'PICTURE_TOO_LARGE', message: `"cabinet-photo.png" is ${String(kilobytes)} KB. Pictures must be under 200 KB. Choose a smaller picture.` });
    expectNothingChanged(setup);
  });

  it.each([
    ['a text file renamed .png', PLAIN_TEXT],
    ['an SVG', SVG_TEXT],
    ['a file of 0 bytes', Buffer.alloc(0)],
    ['a PNG with a script after it', Buffer.concat([smallPng(), SCRIPT_TAIL])],
    ['a cut-short PNG', smallPng().subarray(0, 30)],
  ])('refuses %s as the wrong type (415) in the words of SCR-05', async (_name, bytes) => {
    const setup = setUp();
    const error = await refusal(setup.put(bytes, 'cabinet-photo.png'));
    expect(error).toBeInstanceOf(UnsupportedMediaTypeError);
    expect(error).toMatchObject({ httpStatus: 415, code: 'PICTURE_TYPE_REFUSED', message: 'Only PNG, JPG, GIF or WebP pictures are accepted.' });
    expectNothingChanged(setup);
  });

  it('refuses a replacement as it refuses a first picture, and leaves the part with the picture it had', async () => {
    const setup = setUp();
    await setup.put(smallPng());
    const before = defined(setup.world.images[0]);
    await refusal(setup.put(PLAIN_TEXT));
    expect(setup.stored().imageId).toBe(before.id);
    expect(setup.stored().revision).toBe(2);
    expect(setup.inputsRevision()).toBe(1);
    expect(setup.world.images).toHaveLength(1);
  });

  it('a JPEG of 199 KB is accepted and one of 201 KB is not', async () => {
    const setup = setUp();
    await setup.put(jpegOfSize(199 * KB), 'ok.jpg');
    expect(await refusal(setup.put(jpegOfSize(201 * KB), 'big.jpg'))).toBeInstanceOf(PayloadTooLargeError);
  });
});

describe('AC-7: the file name is sanitised on store and the refusals carry the sanitised name', () => {
  it('stores the name as text: markup, quotes and path characters are gone', async () => {
    const setup = setUp();
    const answer = await setup.put(smallPng(), '../../<img src=x onerror=alert(1)>.png');
    expect(answer.picture?.fileName).toBe('img src=x onerror=alert(1).png');
    expect(defined(setup.world.images[0]).fileName).toBe('img src=x onerror=alert(1).png');
    expect(defined(setup.world.images[0]).fileName).not.toMatch(/[<>"'`\\/]/);
  });

  it('stores `picture` for a name with nothing left, and 100 characters at most', async () => {
    const setup = setUp();
    expect((await setup.put(smallPng(), '<>')).picture?.fileName).toBe('picture');
    expect(Array.from(defined((await setup.put(smallJpeg(), `${'x'.repeat(300)}.jpg`)).picture).fileName)).toHaveLength(100);
  });

  it('names the sanitised file in the words of a refusal, never the raw name', async () => {
    const setup = setUp();
    const error = await refusal(setup.put(pngOfSize(201 * KB), '"><script>alert(1)</script>.png'));
    expect(error).toMatchObject({ message: '"script.png" is 201 KB. Pictures must be under 200 KB. Choose a smaller picture.' });
  });
});

describe('AC-4: a picture is stored once for each estimate', () => {
  it('finds the picture another part of the estimate already has, and keeps the name it was first stored with', async () => {
    const setup = setUp();
    await setup.put(smallPng(), 'first-name.png');
    const answer = await setup.put(smallPng(), 'second-name.png', { nodeId: SECOND_PART });
    expect(setup.world.images).toHaveLength(1);
    expect(setup.stored(SECOND_PART).imageId).toBe(defined(setup.world.images[0]).id);
    expect(answer.picture?.fileName).toBe('first-name.png');
    expect(setup.stored(SECOND_PART).revision).toBe(2);
  });

  it('does not share a picture between estimates', async () => {
    const setup = setUp([estimate(), estimate({ id: OTHER_ESTIMATE, code: 'Q-2026-0319' })], [node(PART), node(OTHER_PART, { estimateId: OTHER_ESTIMATE })]);
    await setup.put(smallPng());
    await setup.service.putPicture(arjun, OTHER_ESTIMATE, OTHER_PART, { name: 'a.png', bytes: smallPng() });
    expect(setup.world.images).toHaveLength(2);
    expect(new Set(setup.world.images.map((row) => row.estimateId)).size).toBe(2);
  });
});

describe('AC-6 and FR-064: who may change a picture, and when', () => {
  it('lets an Engineer change a draft, and a Lead or an Admin change a draft and a submitted estimate', async () => {
    for (const viewer of [arjun, lead, admin]) {
      const setup = setUp();
      await setup.put(smallPng(), 'a.png', { viewer });
      expect(setup.stored().imageId).not.toBeNull();
    }
    for (const viewer of [lead, admin]) {
      const setup = setUp([estimate({ status: 'SUBMITTED' })]);
      await setup.put(smallPng(), 'a.png', { viewer });
      expect(setup.stored().imageId).not.toBeNull();
    }
  });

  it.each(['put', 'remove'] as const)('refuses an Engineer on a submitted estimate with 409 and the not-editable code, and changes nothing (%s)', async (action) => {
    const setup = setUp([estimate({ status: 'SUBMITTED' })]);
    const error = await refusal(action === 'put' ? setup.put(smallPng()) : setup.remove());
    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ httpStatus: 409, code: ESTIMATE_NOT_EDITABLE_CODE });
    expectNothingChanged(setup);
  });

  it.each(['put', 'remove'] as const)('refuses everyone on an approved estimate with 409 (%s)', async (action) => {
    for (const viewer of [arjun, lead, admin]) {
      const setup = setUp([estimate({ status: 'APPROVED' })]);
      const error = await refusal(action === 'put' ? setup.put(smallPng(), 'a.png', { viewer }) : setup.remove({ viewer }));
      expect(error, viewer.role).toMatchObject({ httpStatus: 409, code: ESTIMATE_NOT_EDITABLE_CODE });
      expectNothingChanged(setup);
    }
  });

  it.each(['put', 'remove'] as const)('answers a stranger and an unknown estimate or part with the same 404 (%s)', async (action) => {
    const setup = setUp();
    const attempts = [
      () => (action === 'put' ? setup.put(smallPng(), 'a.png', { viewer: priya }) : setup.remove({ viewer: priya })),
      () => (action === 'put' ? setup.put(smallPng(), 'a.png', { estimateId: MISSING }) : setup.service.removePicture(arjun, MISSING, PART)),
      () => (action === 'put' ? setup.put(smallPng(), 'a.png', { estimateId: 'not-an-id' }) : setup.service.removePicture(arjun, 'not-an-id', PART)),
      () => (action === 'put' ? setup.put(smallPng(), 'a.png', { nodeId: MISSING }) : setup.remove({ nodeId: MISSING })),
      () => (action === 'put' ? setup.put(smallPng(), 'a.png', { nodeId: 'not-an-id' }) : setup.remove({ nodeId: 'not-an-id' })),
    ];
    for (const attempt of attempts) {
      const error = await refusal(attempt());
      expect(error).toBeInstanceOf(NotFoundError);
      expect(error).toMatchObject({ httpStatus: 404, message: 'Not found.' });
    }
    expectNothingChanged(setup);
  });

  it('does not change a part of another estimate through this estimate', async () => {
    const setup = setUp([estimate(), estimate({ id: OTHER_ESTIMATE, code: 'Q-2026-0319' })], [node(PART), node(OTHER_PART, { estimateId: OTHER_ESTIMATE })]);
    expect(await refusal(setup.put(smallPng(), 'a.png', { nodeId: OTHER_PART }))).toBeInstanceOf(NotFoundError);
    expect(setup.world.images).toHaveLength(0);
  });

  it('answers in the order 404, 409, then the content: a stranger is not told the file is wrong, nor is an Engineer on a submitted estimate', async () => {
    const stranger = setUp();
    expect(await refusal(stranger.put(PLAIN_TEXT, 'a.png', { viewer: priya }))).toBeInstanceOf(NotFoundError);
    expect(await refusal(stranger.put(pngOfSize(201 * KB), 'a.png', { viewer: priya }))).toBeInstanceOf(NotFoundError);
    const submitted = setUp([estimate({ status: 'SUBMITTED' })]);
    expect(await refusal(submitted.put(PLAIN_TEXT))).toMatchObject({ httpStatus: 409 });
    expect(await refusal(submitted.put(pngOfSize(201 * KB)))).toMatchObject({ httpStatus: 409 });
  });
});

describe('AC-4: the change is one transaction', () => {
  it('stores nothing and points at nothing when the estimate revision cannot be raised', async () => {
    const world = createFakeEstimateWorld(() => [], [estimate()], [node(PART)]);
    const failing = createEstimateService({
      estimates: { ...world.repository, bumpInputsRevision: () => Promise.reject(new Error('the revision write failed')) },
      nodes: world.nodeRepository,
      images: world.imageRepository,
      transactions: world.transactions,
      ...inputsDependencies(),
    });
    await expect(failing.putPicture(arjun, ESTIMATE, PART, { name: 'a.png', bytes: smallPng() })).rejects.toThrow('the revision write failed');
    expect(world.images).toHaveLength(0);
    expect(defined(world.nodes[0]).imageId ?? null).toBeNull();
    expect(defined(world.nodes[0]).revision).toBe(1);
  });

  it('is refused (409) and writes nothing when the part changed after it was read', async () => {
    const world = createFakeEstimateWorld(() => [], [estimate()], [node(PART)]);
    const racing = createEstimateService({
      estimates: world.repository,
      nodes: { ...world.nodeRepository, setImage: () => Promise.resolve(null) },
      images: world.imageRepository,
      transactions: world.transactions,
      ...inputsDependencies(),
    });
    const error = await refusal(racing.putPicture(arjun, ESTIMATE, PART, { name: 'a.png', bytes: smallPng() }));
    expect(error).toMatchObject({ httpStatus: 409, code: 'PART_CHANGED' });
    expect(world.images).toHaveLength(0);
    expect(defined(world.estimates[0]).inputsRevision).toBe(0);
  });
});

describe('AC-5: reading a picture', () => {
  async function withPicture() {
    const setup = setUp();
    const png = smallPng();
    await setup.put(png, 'front.png');
    return { setup, id: defined(setup.world.images[0]).id, png };
  }

  it('gives the owning Engineer, a Lead and an Admin the stored type and the bytes as they were', async () => {
    const { setup, id, png } = await withPicture();
    for (const viewer of [arjun, lead, admin]) {
      const file = await setup.service.getPicture(viewer, id);
      expect(file.mime).toBe('image/png');
      expect([...file.bytes]).toEqual([...png]);
    }
  });

  it('gives another Engineer, an unknown ID and an ID that is not one the same 404', async () => {
    const { setup, id } = await withPicture();
    const answers: unknown[] = [];
    for (const attempt of [() => setup.service.getPicture(priya, id), () => setup.service.getPicture(arjun, MISSING), () => setup.service.getPicture(arjun, 'not-an-id')]) {
      answers.push(await refusal(attempt()));
    }
    for (const answer of answers) expect(answer).toBeInstanceOf(NotFoundError);
    expect(new Set(answers.map((answer) => JSON.stringify({ status: (answer as NotFoundError).httpStatus, message: (answer as NotFoundError).message, code: (answer as NotFoundError).code }))).size).toBe(1);
  });

  it('still serves the picture of an estimate that is submitted or approved (a read is not a change)', async () => {
    const { setup, id } = await withPicture();
    for (const status of ['SUBMITTED', 'APPROVED'] as const) {
      defined(setup.world.estimates[0]).status = status;
      expect((await setup.service.getPicture(arjun, id)).mime).toBe('image/png');
    }
  });

  it('shows a part its picture by ID, sanitised name and size, and shows none after it is removed', async () => {
    const { setup, id } = await withPicture();
    expect((await setup.service.getNode(arjun, ESTIMATE, PART)).picture).toEqual({ id, fileName: 'front.png', sizeBytes: smallPng().length });
    await setup.remove();
    expect((await setup.service.getNode(arjun, ESTIMATE, PART)).picture).toBeNull();
  });
});

describe('the revision of the part moves with its picture', () => {
  it('a text save with the old revision is refused after a picture changed the part, and the new revision is accepted', async () => {
    const setup = setUp();
    const answer = await setup.put(smallPng());
    const field = '00000000-0000-4000-8000-0000000000aa';
    await expect(setup.service.saveInputs(arjun, ESTIMATE, { nodeId: PART, revision: 1, values: { [field]: '1' } })).rejects.toMatchObject({ code: 'PART_CHANGED' });
    expect(answer.revision).toBe(2);
  });

  it('a delete confirmed for the part as it was is refused after a picture changed it', async () => {
    const setup = setUp();
    await setup.put(smallPng());
    await expect(setup.service.deleteNode(arjun, ESTIMATE, { nodeId: PART, revision: 1, parts: 1, subtree: '0000000000000000' })).rejects.toMatchObject({ code: 'TREE_CHANGED' });
  });
});
