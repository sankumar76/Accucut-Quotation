import { buildWorkbook } from '../../src/server/export/build-workbook';
import type { ExportModel } from '../../src/server/export/export-model';
import type { ExportBuilder, ExportPlace } from '../../src/server/export/thread-runner';

/**
 * A builder for the tests that are not about the thread (STORY-07.02): the file is built in this process by `buildWorkbook`, and every place is free. `thread.test.ts` runs the real thread and the real
 * places. A test that wants to see the places passes `spy`, which is told each time a place is taken (with the part count it was asked for) and given back.
 */
export interface InProcessBuilder extends ExportBuilder {
  /** The part counts places were asked for, oldest first. */
  readonly admitted: number[];
  /** How many places were taken and not yet released. */
  open(): number;
  /** The models that were built, oldest first. */
  readonly built: ExportModel[];
}

export function inProcessBuilder(build: (model: ExportModel) => Promise<Uint8Array<ArrayBuffer>> = buildWorkbook, refuse?: (partCount: number) => Error | null): InProcessBuilder {
  const admitted: number[] = [];
  const built: ExportModel[] = [];
  let open = 0;
  return {
    admitted,
    built,
    open: () => open,
    admit(partCount): ExportPlace {
      const refusal = refuse?.(partCount) ?? null;
      if (refusal !== null) throw refusal;
      admitted.push(partCount);
      open += 1;
      let released = false;
      return {
        build: (model) => {
          built.push(model);
          return build(model);
        },
        release() {
          if (released) return;
          released = true;
          open -= 1;
        },
      };
    },
  };
}
