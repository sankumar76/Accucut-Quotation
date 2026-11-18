import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Worker, type WorkerOptions } from 'node:worker_threads';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { bundleExportWorker, EXPORT_WORKER_OUTPUT } from '../../../scripts/lib/export-worker-bundle';
import { headerOnlyModel, SHEET_NAME } from '@/server/export/export-columns';
import type { ExportModel } from '@/server/export/export-model';
import { runExportThread, type ThreadMessage } from '@/server/export/thread-protocol';
import { ExportBusyError } from '@/lib/errors';
import { createThreadBuilder, ExportThreadError, exportThreadFile, transferablesOf, type ExportBuilder, type ExportThreadFailure, type StartThread } from '@/server/export/thread-runner';

import { pngOfDimensions } from '../../support/pictures';
import { seedConfig } from '../../support/seed-config';
import { loadWorkbook } from '../../support/xlsx-parts';

/**
 * The export runs in a `node:worker_threads` thread (STORY-07.01 AC-5; ADR-012). The logic of the thread is `runExportThread`, called here in process with a fake port; the thread itself is run
 * for real, from the bundle `scripts/build-export-worker.ts` makes, so a bundle that cannot load ExcelJS or a thread that cannot answer is found by this test and not by a person downloading.
 */

const model = headerOnlyModel(seedConfig);

/** One build in a place of its own, released when it ends, as the export service does it (`admit`, `build`, `release` in a `finally`). */
async function buildOnce(builder: ExportBuilder, data: ExportModel, partCount = 0): Promise<Uint8Array<ArrayBuffer>> {
  const place = builder.admit(partCount);
  try {
    return await place.build(data);
  } finally {
    place.release();
  }
}
const BAD_MODEL: ExportModel = { sheetName: SHEET_NAME, columns: [{ letter: 'A', header: 'H', width: 8, numFmt: '@' }], rows: [{ cells: { A: Number.NaN } }] };

describe('runExportThread (the thread entry\'s only logic)', () => {
  it('posts the file once, with its buffer transferred', async () => {
    const posted: Array<{ message: ThreadMessage; transfer: ArrayBuffer[] | undefined }> = [];
    await runExportThread({ postMessage: (message, transfer) => void posted.push({ message, transfer }) }, model);
    expect(posted).toHaveLength(1);
    const [only] = posted;
    expect(only?.message.ok).toBe(true);
    if (only?.message.ok !== true) throw new Error('expected a file');
    expect(only.transfer).toEqual([only.message.bytes.buffer]);
    const workbook = await loadWorkbook(only.message.bytes);
    expect(workbook.getWorksheet(SHEET_NAME)?.columnCount).toBe(67);
  });

  it.each([
    ['a number that is not finite', BAD_MODEL],
    ['no model at all', undefined],
    ['a model with a key it does not name', { ...model, formula: '=1+1' }],
    ['a sheet name Excel refuses', { ...model, sheetName: 'a/b' }],
    ['a column letter that is not one', { ...model, columns: [{ letter: 'a1', header: 'H', width: 8, numFmt: '@' }] }],
  ])('refuses %s, reading the data through its schema, and posts the kind of the failure and nothing else', async (_name, data) => {
    const posted: ThreadMessage[] = [];
    await runExportThread({ postMessage: (message) => void posted.push(message) }, data);
    expect(posted).toEqual([{ ok: false, errorName: 'InvalidModel' }]);
  });
});

describe('the thread, run for real from its bundle', () => {
  let scratch = '';
  let bundle = '';

  beforeAll(() => {
    scratch = mkdtempSync(join(tmpdir(), 'export-thread-'));
    bundle = bundleExportWorker(process.cwd(), join(scratch, 'export-worker.mjs'));
  }, 120_000);

  afterAll(() => rmSync(scratch, { recursive: true, force: true }));

  it('builds the same file in its own thread, and ExcelJS reads it back', async () => {
    const bytes = await buildOnce(createThreadBuilder({ entry: bundle }), model);
    const workbook = await loadWorkbook(bytes);
    const sheet = workbook.getWorksheet(SHEET_NAME);
    expect(sheet?.getCell('A1').value).toBe(model.columns[0]?.header);
    expect(sheet?.getCell('BO1').value).toBe(model.columns[66]?.header);
  }, 60_000);

  it('builds a file with a picture in its own thread, moves the bytes of the picture to it, and ExcelJS reads the picture back from the file (AC-4)', async () => {
    const bytes = new Uint8Array(pngOfDimensions(64, 32));
    const withPicture: ExportModel = { ...model, rows: [{ cells: { A: '1' }, picture: 0 }], pictures: [{ extension: 'png', bytes }], pictureColumn: 'C' };
    const seen: WorkerOptions[] = [];
    const startThread: StartThread = (entry, given) => {
      seen.push(given);
      return new Worker(entry, given);
    };
    const file = await buildOnce(createThreadBuilder({ entry: bundle, startThread }), withPicture);
    expect(seen[0]?.transferList).toHaveLength(1);
    // The bytes were moved, not copied: this side no longer holds them.
    expect(bytes.byteLength).toBe(0);
    const sheet = (await loadWorkbook(file)).getWorksheet(SHEET_NAME);
    expect(sheet?.getImages()).toHaveLength(1);
  }, 60_000);

  it('answers a failure of the build as one error that names no value', async () => {
    const outcome = await buildOnce(createThreadBuilder({ entry: bundle }), BAD_MODEL).catch((error: unknown) => error);
    expect(outcome).toBeInstanceOf(ExportThreadError);
    expect((outcome as ExportThreadError).reason).toBe('failed');
    expect((outcome as ExportThreadError).message).not.toMatch(/NaN|finite|A2/);
  }, 60_000);

  it('does not build on the main thread when the bundle is missing', async () => {
    const outcome = await buildOnce(createThreadBuilder({ entry: join(scratch, 'no-such-file.mjs') }), model).catch((error: unknown) => error);
    expect(outcome).toMatchObject({ name: 'ExportThreadError', reason: 'missing' });
  });

  it.each([
    ['a thread that throws', 'throw new Error("a secret typed by a person");', 'failed'],
    ['a thread that ends without an answer', 'process.exit(0);', 'exited'],
  ] as const)('reports %s as %s', async (_name, source, reason) => {
    const entry = join(scratch, `${reason}.mjs`);
    writeFileSync(entry, source);
    const outcome = await buildOnce(createThreadBuilder({ entry }), model).catch((error: unknown) => error);
    expect(outcome).toMatchObject({ name: 'ExportThreadError', reason });
    expect((outcome as Error).message).not.toContain('secret');
  });

  it('refuses a build beyond the number of threads allowed, with ExportBusyError and no thread, and takes builds again once one has ended (QS-01)', async () => {
    const entry = join(scratch, 'hang-busy.mjs');
    writeFileSync(entry, 'setInterval(() => {}, 1000);');
    const builder = createThreadBuilder({ entry, timeoutMs: 400, maxThreads: 1 });
    const first = buildOnce(builder, model).catch((error: unknown) => error);
    const second = await buildOnce(builder, model).catch((error: unknown) => error);
    expect(second).toBeInstanceOf(ExportBusyError);
    expect(second).toMatchObject({ httpStatus: 503, code: 'EXPORT_BUSY', retryAfterSeconds: 10 });
    expect(await first).toMatchObject({ reason: 'timeout' });
    // The first has ended and given its place back.
    expect(await buildOnce(builder, model).catch((error: unknown) => error)).toMatchObject({ reason: 'timeout' });
  });

  it('ends a build that outgrows its heap as that thread\'s failure alone, and the test process goes on (QS-01)', async () => {
    const entry = join(scratch, 'grow.mjs');
    writeFileSync(entry, 'const kept = []; for (;;) kept.push(new Array(1_000_000).fill(1));');
    const outcome = await buildOnce(createThreadBuilder({ entry, heapLimitMb: 64 }), model).catch((error: unknown) => error);
    expect(outcome).toMatchObject({ name: 'ExportThreadError', reason: 'failed', code: 'EXPORT_THREAD_FAILED', httpStatus: 500 });
    // The process is alive and builds the next file.
    expect((await buildOnce(createThreadBuilder({ entry: bundle }), model)).byteLength).toBeGreaterThan(1_000);
  }, 60_000);

  it('starts every thread with the heap limit it was given, so the limit is proved to be passed and not only assumed (QS-13)', async () => {
    const options: WorkerOptions[] = [];
    const startThread: StartThread = (entry, given) => {
      options.push(given);
      return new Worker(entry, given);
    };
    await buildOnce(createThreadBuilder({ entry: bundle, heapLimitMb: 300, startThread }), model);
    await buildOnce(createThreadBuilder({ entry: bundle, startThread }), model);
    expect(options.map((given) => given.resourceLimits)).toEqual([{ maxOldGenerationSizeMb: 300 }, { maxOldGenerationSizeMb: 512 }]);
  }, 60_000);

  it('gives the place back when the thread cannot even be started: a model that cannot be cloned, then a valid one that builds (QS-12)', async () => {
    const builder = createThreadBuilder({ entry: bundle, maxThreads: 1 });
    // A function cannot be cloned into a thread: the constructor throws at once.
    const uncloneable: ExportModel = { ...model, rows: [{ cells: { A: () => 'x' } as unknown as Record<string, string> }] };
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(await buildOnce(builder, uncloneable).catch((error: unknown) => error)).toMatchObject({ name: 'ExportThreadError', reason: 'failed' });
    }
    expect((await buildOnce(builder, model)).byteLength).toBeGreaterThan(1_000);
  }, 60_000);

  it('gives the log a code for each kind of failure, so a missing bundle, a crash and a timeout can be told apart (QS-04)', () => {
    const reasons: ExportThreadFailure[] = ['missing', 'failed', 'exited', 'timeout'];
    expect(reasons.map((reason) => new ExportThreadError(reason).code)).toEqual([
      'EXPORT_THREAD_MISSING',
      'EXPORT_THREAD_FAILED',
      'EXPORT_THREAD_EXITED',
      'EXPORT_THREAD_TIMEOUT',
    ]);
  });

  it('stops a thread that never answers, after the time allowed', async () => {
    const entry = join(scratch, 'hang.mjs');
    writeFileSync(entry, 'setInterval(() => {}, 1000);');
    const outcome = await buildOnce(createThreadBuilder({ entry, timeoutMs: 200 }), model).catch((error: unknown) => error);
    expect(outcome).toMatchObject({ name: 'ExportThreadError', reason: 'timeout' });
  });
});

describe('the places of the builder: the cap and the one-large-at-a-time gate (QS-01; STORY-07.02, GitHub issue 440)', () => {
  const builder = (options: { maxThreads?: number; maxLarge?: number } = {}) => createThreadBuilder({ entry: 'never-started.mjs', ...options });
  const busy = { name: 'ExportBusyError', httpStatus: 503, code: 'EXPORT_BUSY', retryAfterSeconds: 10 };

  it('takes at most two places at once, and refuses the third with the one EXPORT_BUSY refusal, never queued', () => {
    const places = builder();
    const first = places.admit(10);
    places.admit(10);
    expect(() => places.admit(10)).toThrow(expect.objectContaining(busy));
    first.release();
    expect(() => places.admit(10)).not.toThrow();
  });

  it('lets one large estimate (over 100 parts) hold a place at a time, counted from its part count; a small one still gets the other place', () => {
    const places = builder();
    const large = places.admit(101);
    expect(() => places.admit(500)).toThrow(expect.objectContaining(busy));
    // 100 parts is not over 100.
    const small = places.admit(100);
    expect(() => places.admit(1)).toThrow(expect.objectContaining(busy));
    large.release();
    expect(() => places.admit(2_000)).not.toThrow();
    small.release();
  });

  it('is for one build while it is held: a build after the release, or a second build in the same place, is refused and starts no thread (review SQR-02 of AQP-332)', async () => {
    const started: string[] = [];
    const places = createThreadBuilder({ entry: 'never-started.mjs', startThread: (entry) => (started.push(entry), new Worker('')) });
    const released = places.admit(1);
    released.release();
    await expect(released.build(model)).rejects.toThrow('released or already used');
    const once = places.admit(1);
    // The first build is refused for the missing bundle (no thread is started); it still uses the place up.
    await expect(once.build(model)).rejects.toMatchObject({ reason: 'missing' });
    await expect(once.build(model)).rejects.toThrow('released or already used');
    once.release();
    expect(started).toEqual([]);
  });

  it('gives a place back once, however many times release is called, so a second release cannot make room that is not there', () => {
    const places = builder({ maxThreads: 1 });
    const only = places.admit(1);
    only.release();
    only.release();
    places.admit(1);
    expect(() => places.admit(1)).toThrow(expect.objectContaining(busy));
  });

  it('gives the place of a large estimate back so the next large estimate can build', () => {
    const places = builder({ maxThreads: 5 });
    places.admit(101).release();
    expect(() => places.admit(101)).not.toThrow();
  });
});

describe('the pictures go to the thread by transfer, where the model owns them whole', () => {
  const pictureOf = (bytes: Uint8Array) => ({ extension: 'png' as const, bytes });

  it('lists the buffer of a picture that is the whole of its buffer, once for pictures that share it, and not the buffer of a view into a larger one', () => {
    const own = new Uint8Array(pngOfDimensions(8, 8));
    const pool = new Uint8Array(1_000);
    const view = pool.subarray(100, 200);
    const listed = transferablesOf({ ...model, pictures: [pictureOf(own), pictureOf(own), pictureOf(view)] });
    expect(listed).toEqual([own.buffer]);
    expect(transferablesOf(model)).toEqual([]);
  });
});

describe('the bundle script', () => {
  it('names the entry, and nothing of the output, when esbuild cannot run', () => {
    const scratch = mkdtempSync(join(tmpdir(), 'export-bundle-missing-'));
    try {
      expect(() => bundleExportWorker(scratch, join(scratch, 'out', 'export-worker.mjs'))).toThrow("esbuild failed for 'src/worker/export-thread.ts'.");
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });
});

describe('where the bundle is', () => {
  it('is .next/export-worker.mjs under the folder the server runs in, which is where the build script writes it', () => {
    expect(exportThreadFile('/srv/app').replace(/\\/g, '/')).toBe('/srv/app/.next/export-worker.mjs');
    expect(EXPORT_WORKER_OUTPUT).toBe('.next/export-worker.mjs');
  });
});
