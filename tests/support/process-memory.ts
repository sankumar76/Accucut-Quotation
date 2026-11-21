/**
 * The memory of the whole process while a build runs (STORY-07.05 AC-2): the **resident set**, sampled on a timer, as the increase over the process before the work starts. The main thread holds the
 * pictures it read, the export thread holds the workbook it builds, and the file travels back, so only the resident set of the process holds them all (the heap of one thread would miss the others).
 * A sample is taken when the watch starts and again when it stops, so a short build is never reported as 0. The reader is a parameter so the watch is tested without a real process.
 */

const MEGABYTE = 1_048_576;
const DEFAULT_SAMPLE_MS = 25;

export interface MemoryReading {
  /** The resident set when the watch started, in MB. */
  readonly startMb: number;
  /** The highest resident set seen, in MB. */
  readonly peakMb: number;
  /** The peak over the start, in MB (never below 0). */
  readonly increaseMb: number;
}

export interface MemoryWatch {
  /** Takes a last sample, stops the timer and gives the reading. */
  stop(): MemoryReading;
}

export interface MemoryWatchOptions {
  /** The resident set now, in bytes. */
  readonly readBytes?: () => number;
  readonly sampleMs?: number;
}

export function watchPeakMemory({ readBytes = () => process.memoryUsage().rss, sampleMs = DEFAULT_SAMPLE_MS }: MemoryWatchOptions = {}): MemoryWatch {
  const start = readBytes();
  let peak = start;
  const timer = setInterval(() => {
    peak = Math.max(peak, readBytes());
  }, sampleMs);
  return {
    stop() {
      clearInterval(timer);
      peak = Math.max(peak, readBytes());
      return { startMb: start / MEGABYTE, peakMb: peak / MEGABYTE, increaseMb: (peak - start) / MEGABYTE };
    },
  };
}
