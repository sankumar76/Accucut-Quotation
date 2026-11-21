import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { detectImageType, holdsScriptMarker } from '@/lib/images/signature';

import vitestConfig from '../../vitest.config';
import perfConfig from '../../vitest.perf.config';
import { incompressiblePicture, PERF_PICTURE_BYTES } from '../support/builders/export-pictures';
import { watchPeakMemory } from '../support/process-memory';

/**
 * STORY-07.05: the helpers of the export timings are right (no timing here, no database). The pictures are of the size and kind the benchmark used and do not compress; the memory watch reports the highest
 * value it saw as the increase over its start; the timings run one file at a time, are tagged, and are outside the per-pull-request path (AC-5).
 */

const read = (path: string): string => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

describe('incompressiblePicture (AC-1, AC-2: 199 KB pictures that pass the signature check and do not compress)', () => {
  it('is 199 KB, as the server\'s own check reads a PNG, with no script marker', () => {
    const bytes = incompressiblePicture(0);
    expect(PERF_PICTURE_BYTES).toBe(199 * 1024);
    expect(bytes.byteLength).toBe(PERF_PICTURE_BYTES);
    expect(detectImageType(bytes)).toBe('image/png');
    expect(holdsScriptMarker(bytes)).toBe(false);
  });

  it('does not compress: deflating it saves less than half a percent, where a padded picture would shrink to almost nothing', () => {
    const bytes = incompressiblePicture(7);
    expect(deflateSync(bytes).byteLength / bytes.byteLength).toBeGreaterThan(0.995);
  });

  it('is different every time, and its header names different dimensions for different indexes', () => {
    const first = incompressiblePicture(1);
    const second = incompressiblePicture(1);
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(false);
    expect(Buffer.from(incompressiblePicture(1).subarray(16, 24)).equals(Buffer.from(incompressiblePicture(2).subarray(16, 24)))).toBe(false);
  });

  it('takes another size, down to a small one', () => {
    const bytes = incompressiblePicture(3, 2_000);
    expect(bytes.byteLength).toBe(2_000);
    expect(detectImageType(bytes)).toBe('image/png');
  });
});

describe('watchPeakMemory (AC-2: the peak of the process over its start)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports the highest sample as the increase over the start, in MB, and takes a last sample when it stops', () => {
    vi.useFakeTimers();
    const megabyte = 1_048_576;
    const readings = [100, 150, 400, 250].map((mb) => mb * megabyte);
    let next = 0;
    const watch = watchPeakMemory({ readBytes: () => readings[Math.min(next++, readings.length - 1)] ?? 0, sampleMs: 10 });
    vi.advanceTimersByTime(20);
    // Two timer samples (150, 400) have been taken; the last reading (250) is taken at stop.
    const reading = watch.stop();
    expect(reading.startMb).toBe(100);
    expect(reading.peakMb).toBe(400);
    expect(reading.increaseMb).toBe(300);
  });

  it('never reports a negative increase when the process shrinks, and takes no more samples once stopped', () => {
    vi.useFakeTimers();
    const megabyte = 1_048_576;
    let now = 500 * megabyte;
    const calls = vi.fn(() => now);
    const watch = watchPeakMemory({ readBytes: calls, sampleMs: 10 });
    now = 200 * megabyte;
    vi.advanceTimersByTime(30);
    const reading = watch.stop();
    expect(reading.peakMb).toBe(500);
    expect(reading.increaseMb).toBe(0);
    const taken = calls.mock.calls.length;
    vi.advanceTimersByTime(100);
    expect(calls.mock.calls.length).toBe(taken);
  });

  it('reads the real resident set by default, so a reading is a positive number', () => {
    const reading = watchPeakMemory().stop();
    expect(reading.startMb).toBeGreaterThan(0);
    expect(reading.peakMb).toBeGreaterThanOrEqual(reading.startMb);
  });
});

describe('the export timings are on demand, one file at a time and tagged (AC-5)', () => {
  const FILES = ['export-50x50', 'export-500', 'export-concurrency'] as const;

  it('are outside the per-pull-request path, and the perf configuration runs one file at a time so no timing is taken while another runs', () => {
    expect(vitestConfig.test?.exclude).toContain('tests/perf/**');
    expect(perfConfig.test?.fileParallelism).toBe(false);
  });

  it.each(FILES)('%s carries the @perf tag in the title of its suite', (name) => {
    expect(read(`../perf/${name}.test.ts`)).toMatch(/describe\('@perf /);
  });
});
