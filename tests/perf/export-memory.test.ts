import { randomFillSync } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { bundleExportWorker } from '../../scripts/lib/export-worker-bundle';
import { exportColumnsOf, SHEET_NAME } from '@/server/export/export-columns';
import type { ExportModel, ExportPicture } from '@/server/export/export-model';
import { createThreadBuilder, type ExportBuilder } from '@/server/export/thread-runner';

import { pngOfDimensions } from '../support/pictures';
import { seedConfig } from '../support/seed-config';
import { loadWorkbook } from '../support/xlsx-parts';

/**
 * STORY-07.02 (RISK-010; review QS-01 of AQP-331; AC-8 and NFR-010): the memory and time of an export **with pictures**, on this machine, with the real bundle of the thread. The review of STORY-07.01 measured
 * the cap of two threads and the heap limit of 512 MB with no pictures at all; this measures what the story's note 2 asks for: 50 parts with 50 pictures of 199 KB (AC-8), and 500 parts with 500
 * pictures (the largest tree the architecture's benchmark used), one build and then two at once, and states (i) whether the 500-part file is ended by the heap limit and (ii) how much the process holds
 * while two such builds run. It prints the figures for the pull request; it is on demand (\`npm run test:perf\`, like the other timings) and not part of the per-pull-request path.
 *
 * What is measured: the **resident set of the whole process** (the main thread holds the pictures it read, the thread holds the workbook it builds, and the file travels back), sampled every 25 ms, as the
 * increase over the process before the builds start. The pictures are random bytes, which do not compress, as a photograph does not. Every value is invented.
 */

const MB = 1_048_576;
const PICTURE_BYTES = 199 * 1024;
const SAMPLE_MS = 25;
/** A reference for the host, not a measured fact: the sizing section of the architecture gave the app 1.5 GB. */
const HOST_BUDGET_MB = 1536;

function pictureOf(index: number): ExportPicture {
  const bytes = new Uint8Array(pngOfDimensions(800 + (index % 200), 600, PICTURE_BYTES));
  // The header and the closing chunk stay as they were; the filler between them is random, so the file does not compress.
  randomFillSync(bytes, 60, bytes.length - 80);
  return { extension: 'png', bytes };
}

function modelOf(parts: number, pictures: number): ExportModel {
  const columns = exportColumnsOf(seedConfig);
  const rows = Array.from({ length: parts }, (_, index) => ({
    cells: Object.fromEntries(columns.map((column, place) => [column.letter, column.numFmt === '@' ? `Part ${String(index + 1)} ${String(place)}` : (index + 1) * 1.123456789 + place])),
    picture: index < pictures ? index : null,
  }));
  return { sheetName: SHEET_NAME, columns, rows, pictures: Array.from({ length: pictures }, (_, index) => pictureOf(index)), pictureColumn: 'C' };
}

interface Measure {
  readonly seconds: number;
  readonly peakIncreaseMb: number;
  readonly peakTotalMb: number;
  readonly outcomes: ReadonlyArray<{ readonly ok: boolean; readonly fileMb: number; readonly reason?: string }>;
}

/** Runs the builds at once and watches the process's resident set while they do. */
async function measure(builder: ExportBuilder, models: ReadonlyArray<ExportModel>): Promise<Measure> {
  const before = process.memoryUsage().rss;
  let peak = before;
  const timer = setInterval(() => {
    peak = Math.max(peak, process.memoryUsage().rss);
  }, SAMPLE_MS);
  const started = performance.now();
  const outcomes = await Promise.all(
    models.map(async (model) => {
      const place = builder.admit(model.rows.length);
      try {
        const bytes = await place.build(model);
        return { ok: true, fileMb: bytes.byteLength / MB };
      } catch (error) {
        return { ok: false, fileMb: 0, reason: error instanceof Error ? error.message : 'unknown' };
      } finally {
        place.release();
      }
    }),
  );
  const seconds = (performance.now() - started) / 1000;
  clearInterval(timer);
  peak = Math.max(peak, process.memoryUsage().rss);
  return { seconds, peakIncreaseMb: (peak - before) / MB, peakTotalMb: peak / MB, outcomes };
}

const report = (name: string, result: Measure): void => {
  const files = result.outcomes.map((outcome) => (outcome.ok ? `${outcome.fileMb.toFixed(1)} MB` : `FAILED (${outcome.reason ?? ''})`)).join(', ');
  process.stdout.write(`\nSTORY-07.02 memory: ${name}: ${result.seconds.toFixed(1)} s, process +${result.peakIncreaseMb.toFixed(0)} MB (peak ${result.peakTotalMb.toFixed(0)} MB resident), file ${files}.\n`);
};

let scratch = '';
let bundle = '';

beforeAll(() => {
  scratch = mkdtempSync(join(tmpdir(), 'export-memory-'));
  bundle = bundleExportWorker(process.cwd(), join(scratch, 'export-worker.mjs'));
}, 120_000);

afterAll(() => rmSync(scratch, { recursive: true, force: true }));

describe('the export with pictures, built by the real thread', () => {
  it('AC-8: 50 parts with 50 pictures of 199 KB, one build and then two at once', async () => {
    const builder = createThreadBuilder({ entry: bundle, maxThreads: 2 });
    const one = await measure(builder, [modelOf(50, 50)]);
    report('50 parts, 50 pictures, one build', one);
    const two = await measure(builder, [modelOf(50, 50), modelOf(50, 50)]);
    report('50 parts, 50 pictures, two at once', two);
    for (const result of [one, two]) for (const outcome of result.outcomes) expect(outcome.ok).toBe(true);
    // AC-8 (NFR-010): inside 10 s; the formal gate is STORY-07.05's.
    expect(one.seconds).toBeLessThan(10);
  }, 300_000);

  it('500 parts with 500 pictures: one build is not ended by the heap limit, and the file reads back with every picture', async () => {
    const builder = createThreadBuilder({ entry: bundle, maxThreads: 2, maxLarge: 2 });
    const one = await measure(builder, [modelOf(500, 500)]);
    report('500 parts, 500 pictures, one build', one);
    expect(one.outcomes.every((outcome) => outcome.ok)).toBe(true);
    // Read one back to be sure the file is whole (the measure above discards the bytes).
    const place = builder.admit(500);
    try {
      const sheet = (await loadWorkbook(await place.build(modelOf(500, 500)))).getWorksheet(SHEET_NAME);
      expect(sheet?.getImages()).toHaveLength(500);
      expect(sheet?.actualRowCount).toBe(501);
    } finally {
      place.release();
    }
  }, 600_000);

  it('500 parts with 500 pictures, two at once (the cap of two and, to measure it, two large builds allowed): inside the host\'s budget', async () => {
    const builder = createThreadBuilder({ entry: bundle, maxThreads: 2, maxLarge: 2 });
    const two = await measure(builder, [modelOf(500, 500), modelOf(500, 500)]);
    report('500 parts, 500 pictures, two at once', two);
    expect(two.outcomes.every((outcome) => outcome.ok)).toBe(true);
    expect(two.peakIncreaseMb).toBeLessThan(HOST_BUDGET_MB);
  }, 900_000);
});
