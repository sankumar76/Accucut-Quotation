import { buildWorkbook } from './build-workbook';
import { exportModelSchema } from './export-model';

/**
 * What the export thread does (ADR-012; STORY-07.01 AC-5), as a function of two plain arguments so a test calls it in process: the thread entry (`src/worker/export-thread.ts`) only hands it
 * `parentPort` and `workerData`, because code that runs inside `new Worker()` is invisible to the coverage tool (test strategy section 11) and so holds no logic.
 *
 * The model comes in as `workerData`, which is `unknown`: it is read through its schema (`exportModelSchema`), never assumed. The file goes out as one message with its bytes **transferred** (no copy of
 * a file that can be about 100 MB), and a failure goes out as a message that carries the **kind** of the failure and nothing else: an error's text can hold what a person typed (coding standards section 4).
 */

/** The messages the thread sends its parent. */
export type ThreadMessage =
  | { readonly ok: true; readonly bytes: Uint8Array<ArrayBuffer> }
  | { readonly ok: false; readonly errorName: string };

/** The part of `MessagePort` the thread uses. */
export interface ThreadPort {
  postMessage(message: ThreadMessage, transfer?: ArrayBuffer[]): void;
}

const INVALID_MODEL = 'InvalidModel';

export async function runExportThread(port: ThreadPort, data: unknown): Promise<void> {
  const model = exportModelSchema.safeParse(data);
  if (!model.success) {
    port.postMessage({ ok: false, errorName: INVALID_MODEL });
    return;
  }
  try {
    const bytes = await buildWorkbook(model.data);
    port.postMessage({ ok: true, bytes }, [bytes.buffer]);
  } catch (error) {
    port.postMessage({ ok: false, errorName: error instanceof Error ? error.name : 'NonError' });
  }
}
