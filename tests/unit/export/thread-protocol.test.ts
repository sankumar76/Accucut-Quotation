import { describe, expect, it, vi } from 'vitest';

import { headerOnlyModel } from '@/server/export/export-columns';
import { runExportThread, type ThreadMessage } from '@/server/export/thread-protocol';

import { seedConfig } from '../../support/seed-config';

/**
 * The failure paths of the thread's one function (STORY-07.01 AC-5): a build that throws is answered with the kind of the failure and never its text, whatever was thrown. The build is replaced here, so
 * a failure the schema lets through can be made. The success path and the schema are `thread.test.ts`'s.
 */

const build = vi.hoisted(() => vi.fn());
vi.mock('@/server/export/build-workbook', () => ({ buildWorkbook: build }));

const model = headerOnlyModel(seedConfig);

async function answerFor(failure: unknown): Promise<ThreadMessage[]> {
  build.mockRejectedValueOnce(failure);
  const posted: ThreadMessage[] = [];
  await runExportThread({ postMessage: (message) => void posted.push(message) }, model);
  return posted;
}

describe('runExportThread, when the build fails', () => {
  it('posts the name of the error and not its message, which could hold what a person typed', async () => {
    const error = new RangeError('A part named "=cmd|calc" is wrong');
    expect(await answerFor(error)).toEqual([{ ok: false, errorName: 'RangeError' }]);
  });

  it('names a thrown value that is not an error', async () => {
    expect(await answerFor('a string')).toEqual([{ ok: false, errorName: 'NonError' }]);
  });
});
