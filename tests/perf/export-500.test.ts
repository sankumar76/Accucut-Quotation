import { performance } from 'node:perf_hooks';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SHEET_NAME } from '@/server/export/export-columns';
import { createThreadBuilder } from '@/server/export/thread-runner';

import { openExportPerfWorld, type ExportPerfWorld } from '../support/export-perf-world';
import { formatReport, summarise } from '../support/perf-stats';
import { watchPeakMemory } from '../support/process-memory';
import { loadWorkbook } from '../support/xlsx-parts';

/**
 * STORY-07.05 AC-2 and AC-4 (NFR-010, RISK-010; architecture section 4.6): the export of an estimate of **500 nodes with 500 incompressible pictures of 199 KB**, the validation maximum, 5 times. Time, file size
 * and the peak memory of the process are **recorded and printed, not gated**: the architecture's benchmark showed about 17 s and 528 MB at 500 nodes, and the 10 s target of NFR-010 applies at 50 nodes
 * (`export-50x50.test.ts`). What is checked is only that every run gives a whole file (500 pictures in the first, the size of the others), because a number measured over a failed build says nothing.
 *
 * What is timed is `getFile` of the real export service, built with the production places of the thread (one large build at a time, a heap of 512 MB for the thread): the snapshot of the figures, the pictures
 * read 50 at a time, and the build in the thread. The memory is the resident set of the **whole process** over its value before the run (`process-memory.ts`), which is what a host has to hold; the database
 * driver and the vitest worker are in it too, so it is an upper bound of the export alone. The estimate is built once, before the clock starts.
 *
 * On demand only (`npm run test:perf`; `@perf` in the title selects it), and heavy: it needs PostgreSQL and about a gigabyte of free memory. Every value is invented.
 */

const RUNS = 5;
const PARTS = 500;
const PICTURE_BYTES = 199 * 1024;
const MEGABYTE = 1_048_576;

let world: ExportPerfWorld;
let estimateId: string;

beforeAll(async () => {
  world = await openExportPerfWorld();
  estimateId = await world.calculatedEstimate(PARTS, PICTURE_BYTES);
}, 900_000);

afterAll(async () => {
  await world.close();
});

describe('@perf NFR-010: the export of 500 nodes with 500 pictures of 199 KB is recorded (5 runs, not gated)', { timeout: 1_800_000 }, () => {
  it('gives a whole file every run, and prints the time, the file size and the peak memory of each run and the summary', async () => {
    const exporter = world.exporter(createThreadBuilder({ entry: world.bundle }));
    const seconds: number[] = [];
    const sizes: number[] = [];
    const increases: number[] = [];
    const peaks: number[] = [];
    // The increase is over the process before the first run: a later run starts with what the earlier ones left, so its own start would hide what it holds.
    let baseline: number | undefined;
    for (let run = 0; run < RUNS; run += 1) {
      const watch = watchPeakMemory();
      const started = performance.now();
      const file = await exporter.getFile(world.lead, estimateId);
      seconds.push(performance.now() - started);
      const memory = watch.stop();
      baseline ??= memory.startMb;
      increases.push(memory.peakMb - baseline);
      peaks.push(memory.peakMb);
      sizes.push(file.bytes.byteLength / MEGABYTE);
      // Whole: no smaller than the pictures it holds. The first is read back (the read-back is outside the time and the memory above).
      expect(file.bytes.byteLength).toBeGreaterThan(PARTS * PICTURE_BYTES * 0.9);
      if (run === 0) expect((await loadWorkbook(file.bytes)).getWorksheet(SHEET_NAME)?.getImages()).toHaveLength(PARTS);
    }
    const summary = summarise(seconds);
    const each = seconds.map((ms, run) => `run ${String(run + 1)}: ${(ms / 1000).toFixed(1)} s, file ${(sizes[run] ?? 0).toFixed(1)} MB, process +${(increases[run] ?? 0).toFixed(0)} MB over the start of run 1 (peak ${(peaks[run] ?? 0).toFixed(0)} MB resident)`);
    process.stdout.write(
      `\n${formatReport(`NFR-010 export, ${String(PARTS)} nodes with ${String(PARTS)} pictures of 199 KB, getFile (recorded, not gated)`, summary)}  ${each.join('\n  ')}\n  largest process increase: ${Math.max(...increases).toFixed(0)} MB, largest peak: ${Math.max(...peaks).toFixed(0)} MB resident\n`,
    );
  });
});
