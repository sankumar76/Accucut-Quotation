import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { bundleExportWorker, EXPORT_WORKER_OUTPUT } from '../../../scripts/lib/export-worker-bundle';
import { headerOnlyModel, SHEET_NAME } from '@/server/export/export-columns';
import type { ExportModel } from '@/server/export/export-model';
import { runExportThread, type ThreadMessage } from '@/server/export/thread-protocol';
import { ExportBusyError } from '@/lib/errors';
import { createThreadBuilder, ExportThreadError, exportThreadFile, type ExportThreadFailure } from '@/server/export/thread-runner';

import { seedConfig } from '../../support/seed-config';
import { loadWorkbook } from '../../support/xlsx-parts';

/**
 * The export runs in a `node:worker_threads` thread (STORY-07.01 AC-5; ADR-012). The logic of the thread is `runExportThread`, called here in process with a fake port; the thread itself is run
 * for real, from the bundle `scripts/build-export-worker.ts` makes, so a bundle that cannot load ExcelJS or a thread that cannot answer is found by this test and not by a person downloading.
 */

const model = headerOnlyModel(seedConfig);
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
    const bytes = await createThreadBuilder({ entry: bundle })(model);
    const workbook = await loadWorkbook(bytes);
    const sheet = workbook.getWorksheet(SHEET_NAME);
    expect(sheet?.getCell('A1').value).toBe(model.columns[0]?.header);
    expect(sheet?.getCell('BO1').value).toBe(model.columns[66]?.header);
  }, 60_000);

  it('answers a failure of the build as one error that names no value', async () => {
    const outcome = await createThreadBuilder({ entry: bundle })(BAD_MODEL).catch((error: unknown) => error);
    expect(outcome).toBeInstanceOf(ExportThreadError);
    expect((outcome as ExportThreadError).reason).toBe('failed');
    expect((outcome as ExportThreadError).message).not.toMatch(/NaN|finite|A2/);
  }, 60_000);

  it('does not build on the main thread when the bundle is missing', async () => {
    const outcome = await createThreadBuilder({ entry: join(scratch, 'no-such-file.mjs') })(model).catch((error: unknown) => error);
    expect(outcome).toMatchObject({ name: 'ExportThreadError', reason: 'missing' });
  });

  it.each([
    ['a thread that throws', 'throw new Error("a secret typed by a person");', 'failed'],
    ['a thread that ends without an answer', 'process.exit(0);', 'exited'],
  ] as const)('reports %s as %s', async (_name, source, reason) => {
    const entry = join(scratch, `${reason}.mjs`);
    writeFileSync(entry, source);
    const outcome = await createThreadBuilder({ entry })(model).catch((error: unknown) => error);
    expect(outcome).toMatchObject({ name: 'ExportThreadError', reason });
    expect((outcome as Error).message).not.toContain('secret');
  });

  it('refuses a build beyond the number of threads allowed, with ExportBusyError and no thread, and takes builds again once one has ended (QS-01)', async () => {
    const entry = join(scratch, 'hang-busy.mjs');
    writeFileSync(entry, 'setInterval(() => {}, 1000);');
    const build = createThreadBuilder({ entry, timeoutMs: 400, maxThreads: 1 });
    const first = build(model).catch((error: unknown) => error);
    const second = await build(model).catch((error: unknown) => error);
    expect(second).toBeInstanceOf(ExportBusyError);
    expect(second).toMatchObject({ httpStatus: 503, code: 'EXPORT_BUSY', retryAfterSeconds: 10 });
    expect(await first).toMatchObject({ reason: 'timeout' });
    // The first has ended and given its place back.
    expect(await build(model).catch((error: unknown) => error)).toMatchObject({ reason: 'timeout' });
  });

  it('ends a build that outgrows its heap as that thread\'s failure alone, and the test process goes on (QS-01)', async () => {
    const entry = join(scratch, 'grow.mjs');
    writeFileSync(entry, 'const kept = []; for (;;) kept.push(new Array(1_000_000).fill(1));');
    const outcome = await createThreadBuilder({ entry, heapLimitMb: 64 })(model).catch((error: unknown) => error);
    expect(outcome).toMatchObject({ name: 'ExportThreadError', reason: 'failed', code: 'EXPORT_THREAD_FAILED', httpStatus: 500 });
    // The process is alive and builds the next file.
    expect((await createThreadBuilder({ entry: bundle })(model)).byteLength).toBeGreaterThan(1_000);
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
    const outcome = await createThreadBuilder({ entry, timeoutMs: 200 })(model).catch((error: unknown) => error);
    expect(outcome).toMatchObject({ name: 'ExportThreadError', reason: 'timeout' });
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
