import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ConflictError, NotFoundError, PayloadTooLargeError, UnsupportedMediaTypeError } from '@/lib/errors';
import { createEstimateNodeRepository } from '@/server/repositories/estimate-node-repository';
import { createEstimateRepository } from '@/server/repositories/estimate-repository';
import { createImageRepository } from '@/server/repositories/image-repository';
import { createMasterRepository } from '@/server/repositories/master-repository';
import { createTransactionRunner } from '@/server/repositories/transaction';
import { createEstimateService, ESTIMATE_NOT_EDITABLE_CODE, type EstimateService, type EstimateViewer } from '@/server/services/estimate-service';
import { sha256Of } from '@/server/services/image-service';

import { insertPersonAsOwner } from '../../support/audit-database';
import { openAuthDatabase, type AuthDatabase } from '../../support/auth-database';
import { defined } from '../../support/defined';
import { jpegOfSize, PLAIN_TEXT, pngOfSize, smallGif, smallPng, smallWebp, SVG_TEXT } from '../../support/pictures';
import { seedConfig } from '../../support/seed-config';

/**
 * STORY-05.07 T6 (AC-1, AC-2, AC-4, AC-5, AC-6, AC-7; ADR-013; NFR-005) against real PostgreSQL in a throwaway database: the estimate service over the real repositories. What only the
 * database can show is shown here: the picture stored whole as `bytea` and read back byte for byte, one row for each distinct picture of an estimate, the part's revision and the
 * estimate's `inputs_revision` rising in the same transaction (and not at all for the same file again, a refusal or a failed write), two changes to one estimate at once being
 * serialised by its row lock, a picture of another estimate being refused by the database itself, and the table being immutable: the runtime role can read and add and nothing else,
 * and no role, the owner included, can change or remove a row (grants and triggers), with the constraints that hold the hash, the type, the size and the name. Every name, path and file is invented.
 *
 * The table cannot be emptied, even by the owner, and the picture rows keep their estimates, so each test makes an estimate of its own and nothing is cleaned up: the database is dropped at the end.
 */

const PATH = '\\\\invented-server\\invented-share\\RFQ-123';
const KB = 1024;

let db: AuthDatabase;
let service: EstimateService;
let leadId: string;
let adminId: string;
let arjunId: string;
let priyaId: string;
let taskCounter = 0;

const estimateRepository = (): ReturnType<typeof createEstimateRepository> => createEstimateRepository(db.prisma);
const nodeRepository = (): ReturnType<typeof createEstimateNodeRepository> => createEstimateNodeRepository(db.prisma);
const imageRepository = (): ReturnType<typeof createImageRepository> => createImageRepository(db.prisma);

const buildService = (estimates = estimateRepository()): EstimateService =>
  createEstimateService({
    estimates,
    nodes: nodeRepository(),
    images: imageRepository(),
    transactions: createTransactionRunner(db.prisma),
    materials: createMasterRepository(db.prisma),
    currentConfiguration: () => Promise.resolve(seedConfig),
    configurationById: () => Promise.resolve(seedConfig),
  });

beforeAll(async () => {
  db = await openAuthDatabase();
  service = buildService();
  leadId = await insertPersonAsOwner(db, 'Picture Lead', 'LEAD');
  adminId = await insertPersonAsOwner(db, 'Picture Admin', 'ADMIN');
  arjunId = await insertPersonAsOwner(db, 'Picture Arjun', 'ENGINEER');
  priyaId = await insertPersonAsOwner(db, 'Picture Priya', 'ENGINEER');
});

afterAll(async () => {
  await db.close();
});

const arjun = (): EstimateViewer => ({ id: arjunId, role: 'ENGINEER' });
const priya = (): EstimateViewer => ({ id: priyaId, role: 'ENGINEER' });
const lead = (): EstimateViewer => ({ id: leadId, role: 'LEAD' });
const admin = (): EstimateViewer => ({ id: adminId, role: 'ADMIN' });

/** A new draft estimate of Arjun's, with two parts. Returns the estimate and its parts. */
async function setUpEstimate(status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' = 'DRAFT'): Promise<{ readonly estimateId: string; readonly first: string; readonly second: string }> {
  taskCounter += 1;
  const task = await db.owner.query<{ id: string }>(
    `INSERT INTO tasks (code, engineer_id, assigned_by, folder_path, deadline_at, title, subject) VALUES ($1, $2::uuid, $3::uuid, $4, '2026-11-12T11:30:00Z', 'Invented task', 'Invented subject') RETURNING id::text AS id`,
    [`Q-2026-${String(3000 + taskCounter)}`, arjunId, leadId, PATH],
  );
  const estimate = await db.owner.query<{ id: string }>('INSERT INTO estimates (task_id) VALUES ($1::uuid) RETURNING id::text AS id', [defined(task.rows[0]).id]);
  const estimateId = defined(estimate.rows[0]).id;
  const first = (await service.addPart(arjun(), estimateId, { kind: 'item' })).nodeId;
  const second = (await service.addPart(arjun(), estimateId, { kind: 'item' })).nodeId;
  if (status !== 'DRAFT') await db.owner.query('UPDATE estimates SET status = $2::estimate_status WHERE id = $1::uuid', [estimateId, status]);
  return { estimateId, first, second };
}

interface NodeRow {
  readonly image_id: string | null;
  readonly revision: number;
}

async function node(nodeId: string): Promise<NodeRow> {
  const { rows } = await db.owner.query<NodeRow>('SELECT image_id::text AS image_id, revision FROM estimate_nodes WHERE id = $1::uuid', [nodeId]);
  return defined(rows[0]);
}

async function inputsRevision(estimateId: string): Promise<number> {
  const { rows } = await db.owner.query<{ inputs_revision: number }>('SELECT inputs_revision FROM estimates WHERE id = $1::uuid', [estimateId]);
  return defined(rows[0]).inputs_revision;
}

async function imageCount(estimateId: string): Promise<number> {
  const { rows } = await db.owner.query<{ n: string }>('SELECT count(*) AS n FROM part_images WHERE estimate_id = $1::uuid', [estimateId]);
  return Number(defined(rows[0]).n);
}

async function refusal(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
}

const put = (estimateId: string, nodeId: string, bytes: Uint8Array, name = 'cabinet-photo.png', viewer = arjun()) => service.putPicture(viewer, estimateId, nodeId, { name, bytes });

describe('AC-1, AC-4: a picture is stored whole and the part points at it', () => {
  it('stores the bytes as received, the hash, the type, the size and the sanitised name, and reads them back byte for byte', async () => {
    const { estimateId, first } = await setUpEstimate();
    const png = pngOfSize(199 * KB);
    const answer = await put(estimateId, first, png, '../<b>front</b>.png');
    const { rows } = await db.owner.query<{ sha256: string; mime: string; size_bytes: number; file_name: string; bytes: Buffer; estimate_id: string; id: string }>(
      'SELECT id::text AS id, estimate_id::text AS estimate_id, sha256, mime, size_bytes, file_name, bytes FROM part_images WHERE estimate_id = $1::uuid',
      [estimateId],
    );
    const stored = defined(rows[0]);
    expect(rows).toHaveLength(1);
    expect(stored).toMatchObject({ estimate_id: estimateId, sha256: sha256Of(png), mime: 'image/png', size_bytes: 199 * KB, file_name: 'b.png' });
    expect(Buffer.compare(stored.bytes, png)).toBe(0);
    expect(answer).toEqual({ id: first, revision: 2, completeness: 'EMPTY', picture: { id: stored.id, fileName: 'b.png', sizeBytes: 199 * KB } });
  });

  it('raises the part revision and the estimate inputs_revision by one, in one transaction, and points the part at the picture', async () => {
    const { estimateId, first, second } = await setUpEstimate();
    const before = await inputsRevision(estimateId);
    const answer = await put(estimateId, first, smallPng());
    expect(await node(first)).toEqual({ image_id: defined(answer.picture).id, revision: 2 });
    expect(await inputsRevision(estimateId)).toBe(before + 1);
    // The other part is not touched.
    expect(await node(second)).toEqual({ image_id: null, revision: 1 });
  });

  it('stores each of the three kinds the server takes with the type its content has (a WebP is converted in the browser and refused here)', async () => {
    const { estimateId, first } = await setUpEstimate();
    for (const [bytes, mime] of [
      [smallPng(), 'image/png'],
      [jpegOfSize(300), 'image/jpeg'],
      [smallGif(), 'image/gif'],
    ] as const) {
      const answer = await put(estimateId, first, bytes, 'whatever.bin');
      const { rows } = await db.owner.query<{ mime: string }>('SELECT mime FROM part_images WHERE id = $1::uuid', [defined(answer.picture).id]);
      expect(defined(rows[0]).mime).toBe(mime);
    }
  });

  it('the same file again for the same part writes nothing: no new row, no new revision', async () => {
    const { estimateId, first } = await setUpEstimate();
    const added = await put(estimateId, first, smallPng());
    const revision = await inputsRevision(estimateId);
    const again = await put(estimateId, first, smallPng(), 'another-name.png');
    expect(again).toEqual(added);
    expect(await imageCount(estimateId)).toBe(1);
    expect((await node(first)).revision).toBe(2);
    expect(await inputsRevision(estimateId)).toBe(revision);
  });

  it('a replacement is a new row and the old one stays; both revisions rise again', async () => {
    const { estimateId, first } = await setUpEstimate();
    const one = defined((await put(estimateId, first, smallPng(), 'one.png')).picture);
    const two = defined((await put(estimateId, first, jpegOfSize(500), 'two.jpg')).picture);
    expect(two.id).not.toBe(one.id);
    expect(await imageCount(estimateId)).toBe(2);
    expect(await node(first)).toEqual({ image_id: two.id, revision: 3 });
    expect(await inputsRevision(estimateId)).toBe(2 + 2);
    expect((await db.owner.query('SELECT 1 FROM part_images WHERE id = $1::uuid', [one.id])).rowCount).toBe(1);
  });

  it('removes the picture: the part points at none, both revisions rise, the row stays; removing none writes nothing', async () => {
    const { estimateId, first } = await setUpEstimate();
    await put(estimateId, first, smallPng());
    const revision = await inputsRevision(estimateId);
    expect(await service.removePicture(arjun(), estimateId, first)).toMatchObject({ revision: 3, picture: null });
    expect(await node(first)).toEqual({ image_id: null, revision: 3 });
    expect(await inputsRevision(estimateId)).toBe(revision + 1);
    expect(await imageCount(estimateId)).toBe(1);
    await service.removePicture(arjun(), estimateId, first);
    expect((await node(first)).revision).toBe(3);
    expect(await inputsRevision(estimateId)).toBe(revision + 1);
  });

  it('a part with no picture is whole: it reads with picture null and as EMPTY (D-31)', async () => {
    const { estimateId, first } = await setUpEstimate();
    const detail = await service.getNode(arjun(), estimateId, first);
    expect(detail.picture).toBeNull();
    expect(detail.completeness).toBe('EMPTY');
  });

  it('shows the picture of a part by ID, sanitised name and size', async () => {
    const { estimateId, first } = await setUpEstimate();
    const picture = defined((await put(estimateId, first, smallPng(), 'front.png')).picture);
    expect((await service.getNode(arjun(), estimateId, first)).picture).toEqual(picture);
  });
});

describe('AC-4: one row for each distinct picture of an estimate (ADR-013)', () => {
  it('finds the picture another part of the estimate already has, and keeps its first name', async () => {
    const { estimateId, first, second } = await setUpEstimate();
    const one = defined((await put(estimateId, first, smallPng(), 'first-name.png')).picture);
    const two = defined((await put(estimateId, second, smallPng(), 'second-name.png')).picture);
    expect(two).toEqual(one);
    expect(await imageCount(estimateId)).toBe(1);
    expect((await node(second)).image_id).toBe(one.id);
  });

  it('does not share a picture between estimates', async () => {
    const a = await setUpEstimate();
    const b = await setUpEstimate();
    const one = defined((await put(a.estimateId, a.first, smallPng())).picture);
    const two = defined((await put(b.estimateId, b.first, smallPng())).picture);
    expect(two.id).not.toBe(one.id);
    expect(await imageCount(a.estimateId)).toBe(1);
    expect(await imageCount(b.estimateId)).toBe(1);
  });

  it('the repository finds a stored picture and keeps the name it was first stored with, whoever asks again', async () => {
    const { estimateId } = await setUpEstimate();
    const repository = imageRepository();
    const runner = createTransactionRunner(db.prisma);
    const png = smallPng();
    const stored = await runner.run((tx) => repository.storeImage(estimateId, { sha256: sha256Of(png), mime: 'image/png', fileName: 'first.png', bytes: png }, tx));
    const again = await runner.run((tx) => repository.storeImage(estimateId, { sha256: sha256Of(png), mime: 'image/png', fileName: 'second.png', bytes: png }, tx));
    expect(again).toEqual(stored);
    expect(stored.fileName).toBe('first.png');
    expect(await imageCount(estimateId)).toBe(1);
  });
});

describe('AC-2: a refusal stores nothing', () => {
  it.each([
    ['201 KB', () => pngOfSize(201 * KB), PayloadTooLargeError],
    ['204,800 bytes', () => pngOfSize(204_800), PayloadTooLargeError],
    ['a text file renamed .png', () => PLAIN_TEXT, UnsupportedMediaTypeError],
    ['an SVG', () => SVG_TEXT, UnsupportedMediaTypeError],
    ['a file of 0 bytes', () => Buffer.alloc(0), UnsupportedMediaTypeError],
    ['a WebP that the browser did not convert (DL-237, OQ-PM-10)', () => smallWebp(), UnsupportedMediaTypeError],
  ])('%s: refused, no row, the part and the estimate unchanged', async (_name, bytes, kind) => {
    const { estimateId, first } = await setUpEstimate();
    const revision = await inputsRevision(estimateId);
    expect(await refusal(put(estimateId, first, bytes()))).toBeInstanceOf(kind);
    expect(await imageCount(estimateId)).toBe(0);
    expect(await node(first)).toEqual({ image_id: null, revision: 1 });
    expect(await inputsRevision(estimateId)).toBe(revision);
  });

  it('accepts 204,799 bytes: the largest picture under the limit goes into bytea and comes back whole', async () => {
    const { estimateId, first } = await setUpEstimate();
    const png = pngOfSize(204_799);
    const picture = defined((await put(estimateId, first, png)).picture);
    const file = await service.getPicture(arjun(), picture.id);
    expect(file.bytes.byteLength).toBe(204_799);
    expect(Buffer.compare(Buffer.from(file.bytes), png)).toBe(0);
  });
});

describe('AC-6: who may change a picture, and when (FR-064)', () => {
  it('lets an Engineer change a draft, and a Lead and an Admin change a draft or a submitted estimate', async () => {
    const draft = await setUpEstimate();
    expect((await put(draft.estimateId, draft.first, smallPng())).revision).toBe(2);
    for (const viewer of [lead(), admin()]) {
      const submitted = await setUpEstimate('SUBMITTED');
      expect((await put(submitted.estimateId, submitted.first, smallPng(), 'a.png', viewer)).revision).toBe(2);
    }
  });

  it('refuses an Engineer on a submitted estimate with 409, and everyone on an approved one, and stores nothing', async () => {
    const submitted = await setUpEstimate('SUBMITTED');
    const error = await refusal(put(submitted.estimateId, submitted.first, smallPng()));
    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ httpStatus: 409, code: ESTIMATE_NOT_EDITABLE_CODE });
    expect(await imageCount(submitted.estimateId)).toBe(0);
    const approved = await setUpEstimate('APPROVED');
    for (const viewer of [arjun(), lead(), admin()]) {
      expect(await refusal(put(approved.estimateId, approved.first, smallPng(), 'a.png', viewer)), viewer.role).toMatchObject({ httpStatus: 409 });
      expect(await refusal(service.removePicture(viewer, approved.estimateId, approved.first)), viewer.role).toMatchObject({ httpStatus: 409 });
    }
    expect(await imageCount(approved.estimateId)).toBe(0);
  });

  it('answers a stranger and an unknown estimate or part with the same 404, and a part of another estimate is not reached through this one', async () => {
    const mine = await setUpEstimate();
    const other = await setUpEstimate();
    const missing = '00000000-0000-4000-8000-0000000000ff';
    // Each is started when its turn comes: a promise made earlier and awaited later would be reported as unhandled while the ones before it ran.
    const attempts = [
      () => put(mine.estimateId, mine.first, smallPng(), 'a.png', priya()),
      () => put(missing, mine.first, smallPng()),
      () => put(mine.estimateId, missing, smallPng()),
      () => put('not-an-id', mine.first, smallPng()),
      () => put(mine.estimateId, 'not-an-id', smallPng()),
      () => put(mine.estimateId, other.first, smallPng()),
    ];
    for (const attempt of attempts) expect(await refusal(attempt())).toBeInstanceOf(NotFoundError);
    expect(await imageCount(mine.estimateId)).toBe(0);
    expect(await imageCount(other.estimateId)).toBe(0);
  });
});

describe('AC-4: the change is one transaction under the estimate lock', () => {
  it('stores no picture and points at none when the estimate revision cannot be raised', async () => {
    const { estimateId, first } = await setUpEstimate();
    const failing = buildService({ ...estimateRepository(), bumpInputsRevision: () => Promise.reject(new Error('the revision write failed')) });
    await expect(failing.putPicture(arjun(), estimateId, first, { name: 'a.png', bytes: smallPng() })).rejects.toThrow('the revision write failed');
    expect(await imageCount(estimateId)).toBe(0);
    expect(await node(first)).toEqual({ image_id: null, revision: 1 });
  });

  it('a write that did not hold the lock cannot overwrite a newer one: the revision read is part of the statement', async () => {
    const { estimateId, first } = await setUpEstimate();
    const runner = createTransactionRunner(db.prisma);
    const picture = await runner.run((tx) => imageRepository().storeImage(estimateId, { sha256: sha256Of(smallPng()), mime: 'image/png', fileName: 'a.png', bytes: smallPng() }, tx));
    expect(await runner.run((tx) => nodeRepository().setImage(estimateId, first, 99, picture.id, tx))).toBeNull();
    expect((await node(first)).image_id).toBeNull();
    expect(await runner.run((tx) => nodeRepository().setImage(estimateId, first, 1, picture.id, tx))).toMatchObject({ revision: 2, imageId: picture.id });
  });

  it('two parts given the same file at once are serialised: one row, both parts point at it, the estimate revision rose twice', async () => {
    const { estimateId, first, second } = await setUpEstimate();
    const before = await inputsRevision(estimateId);
    await Promise.all([put(estimateId, first, smallPng()), put(estimateId, second, smallPng())]);
    expect(await imageCount(estimateId)).toBe(1);
    expect((await node(first)).image_id).toBe((await node(second)).image_id);
    expect(await inputsRevision(estimateId)).toBe(before + 2);
  });

  it('two different files for one part at once are serialised: both stored, the part points at the one written last, and its revision rose twice', async () => {
    const { estimateId, first } = await setUpEstimate();
    await Promise.all([put(estimateId, first, smallPng(), 'one.png'), put(estimateId, first, jpegOfSize(400), 'two.jpg')]);
    expect(await imageCount(estimateId)).toBe(2);
    expect((await node(first)).revision).toBe(3);
    expect((await node(first)).image_id).not.toBeNull();
  });

  it('a text save with the revision from before the picture is refused, and a delete confirmed for the part as it was', async () => {
    const { estimateId, first } = await setUpEstimate();
    await put(estimateId, first, smallPng());
    await expect(service.saveInputs(arjun(), estimateId, { nodeId: first, revision: 1, values: {} })).rejects.toMatchObject({ code: 'PART_CHANGED' });
    await expect(service.deleteNode(arjun(), estimateId, { nodeId: first, revision: 1, parts: 1, subtree: '0000000000000000' })).rejects.toMatchObject({ code: 'TREE_CHANGED' });
  });
});

describe('AC-5: a picture is read only by the people who may open its estimate', () => {
  it('gives the owner, a Lead and an Admin the stored type and the bytes as stored', async () => {
    const { estimateId, first } = await setUpEstimate();
    const png = pngOfSize(5000);
    const picture = defined((await put(estimateId, first, png)).picture);
    for (const viewer of [arjun(), lead(), admin()]) {
      const file = await service.getPicture(viewer, picture.id);
      expect(file.mime).toBe('image/png');
      expect(Buffer.compare(Buffer.from(file.bytes), png)).toBe(0);
    }
  });

  it('answers another Engineer, an unknown ID and an ID that is not one with the same 404', async () => {
    const { estimateId, first } = await setUpEstimate();
    const picture = defined((await put(estimateId, first, smallPng())).picture);
    const attempts = [() => service.getPicture(priya(), picture.id), () => service.getPicture(arjun(), '00000000-0000-4000-8000-0000000000ff'), () => service.getPicture(arjun(), 'not-an-id')];
    for (const attempt of attempts) expect(await refusal(attempt())).toBeInstanceOf(NotFoundError);
  });

  it('still serves a submitted estimate\'s picture and one that was replaced (a read is not a change)', async () => {
    const { estimateId, first } = await setUpEstimate();
    const one = defined((await put(estimateId, first, smallPng())).picture);
    await put(estimateId, first, jpegOfSize(500));
    await db.owner.query("UPDATE estimates SET status = 'SUBMITTED' WHERE id = $1::uuid", [estimateId]);
    expect((await service.getPicture(arjun(), one.id)).mime).toBe('image/png');
  });
});

describe('ADR-013, FR-065: the table is immutable', () => {
  let estimateId: string;
  let pictureId: string;

  beforeAll(async () => {
    const made = await setUpEstimate();
    estimateId = made.estimateId;
    pictureId = defined((await put(made.estimateId, made.first, smallPng(), 'immutable.png')).picture).id;
  });

  /**
   * Every row of the table, as its id and an md5 over the whole row's text. The row's text carries every column, `bytes` included (hex), so a refused statement that changed any
   * column of any row, added a row or removed one makes this differ: the ids, the count and the digests are all compared. The digest is computed in PostgreSQL on purpose. Reading
   * every picture back and comparing the Buffers with `toEqual` took seconds per test once earlier tests had stored the 199 KB and 204,799-byte pictures (DEF-045, AQP-373).
   */
  const snapshot = async (): Promise<unknown> => (await db.owner.query('SELECT p.id::text AS id, md5(p::text) AS digest FROM part_images p ORDER BY p.id')).rows;

  it('grants the runtime role SELECT and INSERT and nothing else, on the table and on every column', async () => {
    const { rows } = await db.owner.query<{ privilege: string; granted: boolean }>(
      `SELECT privilege, has_table_privilege('accucut_app', 'part_images', privilege) AS granted FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE']) AS privilege`,
    );
    expect(Object.fromEntries(rows.map((row) => [row.privilege, row.granted]))).toEqual({ SELECT: true, INSERT: true, UPDATE: false, DELETE: false, TRUNCATE: false });
    const columns = await db.owner.query<{ granted: boolean }>(
      `SELECT has_column_privilege('accucut_app', 'part_images', a.attname::text, 'UPDATE') AS granted FROM pg_attribute a WHERE a.attrelid = to_regclass('part_images') AND a.attnum > 0 AND NOT a.attisdropped`,
    );
    expect(columns.rows.length).toBeGreaterThan(0);
    expect(columns.rows.every((row) => row.granted === false)).toBe(true);
  });

  it.each([
    ['UPDATE of the bytes', "UPDATE part_images SET bytes = '\\x00'::bytea"],
    ['UPDATE of the name', "UPDATE part_images SET file_name = 'changed.png'"],
    ['UPDATE of the type', "UPDATE part_images SET mime = 'image/gif'"],
    ['DELETE', 'DELETE FROM part_images'],
    ['TRUNCATE', 'TRUNCATE part_images'],
  ])('the runtime role is refused (no grant): %s', async (_name, statement) => {
    const before = await snapshot();
    await expect(db.runtime.query(statement)).rejects.toMatchObject({ code: '42501' });
    expect(await snapshot()).toEqual(before);
  });

  it.each([
    ['UPDATE of the bytes', "UPDATE part_images SET bytes = '\\x00'::bytea"],
    ['UPDATE of the name', "UPDATE part_images SET file_name = 'changed.png'"],
    ['DELETE', 'DELETE FROM part_images'],
  ])('the owner is refused by the trigger: %s', async (_name, statement) => {
    const before = await snapshot();
    await expect(db.owner.query(statement)).rejects.toMatchObject({ code: '23000', message: expect.stringContaining('Table "part_images" is immutable') });
    expect(await snapshot()).toEqual(before);
  });

  it('TRUNCATE is refused for the owner too, with CASCADE as well', async () => {
    const before = await snapshot();
    await expect(db.owner.query('TRUNCATE part_images')).rejects.toBeInstanceOf(Error);
    await expect(db.owner.query('TRUNCATE part_images CASCADE')).rejects.toMatchObject({ code: '23000', message: expect.stringContaining('is immutable: TRUNCATE is not allowed') });
    expect(await snapshot()).toEqual(before);
  });

  it('the runtime role can still read and add: that is how a picture is stored', async () => {
    const read = await db.runtime.query('SELECT id::text AS id FROM part_images WHERE id = $1::uuid', [pictureId]);
    expect(read.rows).toEqual([{ id: pictureId }]);
  });

  const validRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    estimate_id: estimateId,
    sha256: 'ab'.repeat(32),
    mime: 'image/png',
    bytes: Buffer.from('abc'),
    size_bytes: 3,
    file_name: 'row.png',
    ...overrides,
  });

  async function insert(row: Record<string, unknown>): Promise<void> {
    await db.owner.query('INSERT INTO part_images (estimate_id, sha256, mime, bytes, size_bytes, file_name) VALUES ($1::uuid, $2, $3, $4::bytea, $5::int, $6)', [
      row['estimate_id'],
      row['sha256'],
      row['mime'],
      row['bytes'],
      row['size_bytes'],
      row['file_name'],
    ]);
  }

  it.each([
    ['a hash that is not 64 hex digits', { sha256: 'xyz' }],
    ['a hash in upper case', { sha256: 'AB'.repeat(32) }],
    ['a type that is not one of the four (SVG)', { mime: 'image/svg+xml' }],
    ['a type of HTML', { mime: 'text/html' }],
    ['a size of 0', { size_bytes: 0, bytes: Buffer.alloc(0) }],
    ['a size that is not the length of the bytes', { size_bytes: 4 }],
    ['an empty name', { file_name: '' }],
    ['a name of 101 characters', { file_name: 'n'.repeat(101) }],
  ])('refuses a row with %s (check_violation)', async (_name, overrides) => {
    await expect(insert(validRow(overrides))).rejects.toMatchObject({ code: '23514' });
  });

  it('refuses a picture of 204,800 bytes and accepts one of 204,799 (A-06)', async () => {
    await expect(insert(validRow({ sha256: 'cd'.repeat(32), bytes: Buffer.alloc(204_800, 1), size_bytes: 204_800 }))).rejects.toMatchObject({ code: '23514' });
    await insert(validRow({ sha256: 'ef'.repeat(32), bytes: Buffer.alloc(204_799, 1), size_bytes: 204_799 }));
  });

  it('refuses a second row with the same hash for the same estimate (unique), and a picture of an estimate that does not exist (foreign key)', async () => {
    await insert(validRow({ sha256: '01'.repeat(32) }));
    await expect(insert(validRow({ sha256: '01'.repeat(32) }))).rejects.toMatchObject({ code: '23505' });
    await expect(insert(validRow({ estimate_id: '00000000-0000-4000-8000-0000000000ff', sha256: '02'.repeat(32) }))).rejects.toMatchObject({ code: '23503' });
  });

  it('refuses to point a part at a picture of another estimate, or at one that does not exist (the database itself: a trigger, which runs before the foreign key)', async () => {
    const other = await setUpEstimate();
    await expect(db.owner.query('UPDATE estimate_nodes SET image_id = $2::uuid WHERE id = $1::uuid', [other.first, pictureId])).rejects.toMatchObject({
      code: '23514',
      message: expect.stringContaining('The picture of a part must belong to the same estimate.'),
    });
    await expect(db.owner.query('UPDATE estimate_nodes SET image_id = $2::uuid WHERE id = $1::uuid', [other.first, '00000000-0000-4000-8000-0000000000ff'])).rejects.toMatchObject({ code: '23514' });
    expect((await node(other.first)).image_id).toBeNull();
  });

  it('refuses a part inserted with the picture of another estimate', async () => {
    const other = await setUpEstimate();
    await expect(db.owner.query('INSERT INTO estimate_nodes (estimate_id, sort_index, image_id) VALUES ($1::uuid, 9, $2::uuid)', [other.estimateId, pictureId])).rejects.toMatchObject({ code: '23514' });
  });

  it('the picture a part points at cannot be deleted: the part keeps it, and no row can be deleted anyway', async () => {
    await expect(db.owner.query('DELETE FROM part_images WHERE id = $1::uuid', [pictureId])).rejects.toMatchObject({ code: '23000' });
  });
});
