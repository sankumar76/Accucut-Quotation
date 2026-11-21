import { performance } from 'node:perf_hooks';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SHEET_NAME } from '@/server/export/export-columns';
import { createThreadBuilder } from '@/server/export/thread-runner';

import { openExportPerfWorld, type ExportPerfWorld } from '../support/export-perf-world';
import { formatReport, summarise } from '../support/perf-stats';
import { loadWorkbook } from '../support/xlsx-parts';

/**
 * STORY-07.05 AC-1 and AC-4 (NFR-010, RISK-010; architecture section 4.6 "Measured feasibility"; test strategy section 8): the export of an estimate of **50 nodes with 50 incompressible pictures of 199 KB**,
 * 20 times, has a p95 under 10 seconds, and the test fails otherwise.
 *
 * What is timed is `getFile` of the real export service, which is everything `GET /api/v1/estimates/{id}/export` does after the role is checked: the repeatable-read snapshot of the state and the figures, the
 * pictures read 50 at a time from PostgreSQL, the model made, and the workbook built **in the export thread** (the real bundle, the real places and the real heap limit), up to the file's bytes. The role check,
 * the session and the HTTP framing are not in the figure (the route's own unit test covers them). The first run starts the thread's code cold and is one of the 20 samples. The estimate is built once, before the
 * clock starts, and every run asks for the same file; the first run's file is read back to be sure it is whole (50 pictures), the others are checked for their size.
 *
 * Not part of the per-pull-request path (STORY-03.06 AC-4): `vitest.config.ts` excludes `tests/perf/`; `npm run test:perf` runs it on demand, and `@perf` in the title selects it. It needs the same PostgreSQL as the
 * integration tests. The p95, median, max and the machine are printed for the pull request (AC-4). Every value is invented.
 */

const RUNS = 20;
const PARTS = 50;
const PICTURE_BYTES = 199 * 1024;
const P95_LIMIT_SECONDS = 10;

let world: ExportPerfWorld;
let estimateId: string;

beforeAll(async () => {
  world = await openExportPerfWorld();
  estimateId = await world.calculatedEstimate(PARTS, PICTURE_BYTES);
}, 300_000);

afterAll(async () => {
  await world.close();
});

describe('@perf NFR-010: the export of 50 nodes with 50 pictures of 199 KB takes under 10 seconds (p95 of 20 runs)', { timeout: 600_000 }, () => {
  it('has a p95 under 10 s through the whole path of getFile, and the machine, p95, median and max are printed', async () => {
    const exporter = world.exporter(createThreadBuilder({ entry: world.bundle }));
    const samples: number[] = [];
    let fileBytes = 0;
    for (let run = 0; run < RUNS; run += 1) {
      const started = performance.now();
      const file = await exporter.getFile(world.lead, estimateId);
      samples.push(performance.now() - started);
      if (run === 0) {
        fileBytes = file.bytes.byteLength;
        // The file is whole: every picture is in it, in the sheet of the worksheet's own layout.
        const sheet = (await loadWorkbook(file.bytes)).getWorksheet(SHEET_NAME);
        expect(sheet?.getImages()).toHaveLength(PARTS);
      }
      // 50 pictures that do not compress: the file cannot be smaller than they are (the pictures are stored as they are in the package).
      expect(file.bytes.byteLength).toBeGreaterThan(PARTS * PICTURE_BYTES * 0.9);
    }
    const summary = summarise(samples);
    process.stdout.write(`\n${formatReport(`NFR-010 export, ${String(PARTS)} nodes with ${String(PARTS)} pictures of 199 KB, getFile (database reads, thread build), file ${(fileBytes / 1_048_576).toFixed(1)} MB`, summary)}`);
    expect(summary.p95Ms / 1000).toBeLessThan(P95_LIMIT_SECONDS);
  });
});
