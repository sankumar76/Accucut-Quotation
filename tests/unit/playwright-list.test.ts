import { existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * DEF-022 (AQP-236): every `playwright test --list` that the guard tests start has a Playwright cache folder of its own, so two
 * listings on a cold cache cannot write to one folder together and report compiled line numbers. The real race needs two
 * cold Playwright processes and fails only some of the time, so it cannot be a deterministic unit test. These tests pin the
 * cause instead: no two listings, in flight at the same time, share a folder; the folder is new and empty; the rest of the
 * environment is kept; and nothing is left behind, whether the listing worked or failed. `child_process` is replaced, so no
 * Playwright process starts. The cold-cache loop that shows the race gone is in the pull request.
 */

interface FakeRunOptions {
  readonly env?: NodeJS.ProcessEnv | undefined;
}

type FakeHandler = (options: FakeRunOptions) => Promise<{ stdout: string }>;

const fake = vi.hoisted((): { handler: FakeHandler } => ({ handler: async () => ({ stdout: '' }) }));

vi.mock('node:child_process', async () => {
  const { promisify } = await import('node:util');
  // `listPlaywrightSuites` calls `promisify(execFile)`; Node honours this custom form, so the fake takes the place of the child.
  const execFile = (): never => {
    throw new Error('execFile is replaced by its promisified form in this test');
  };
  Object.defineProperty(execFile, promisify.custom, {
    value: (_file: string, _args: ReadonlyArray<string>, options: FakeRunOptions) => fake.handler(options),
  });
  return { execFile };
});

const { CACHE_DIR_VARIABLE, listPlaywrightSuites, withPrivateListCache } = await import('../support/playwright-list');

const EMPTY_LIST = JSON.stringify({ suites: [] });

/** The cache folder a fake listing was given. A listing with none fails the test that reads it. */
function cacheFolderOf(options: FakeRunOptions): string {
  const folder = options.env?.[CACHE_DIR_VARIABLE];
  if (folder === undefined) throw new Error(`the listing was started without ${CACHE_DIR_VARIABLE}`);
  return folder;
}

describe('AQP-236 (DEF-022): each Playwright listing has a cache folder of its own', () => {
  beforeEach(() => {
    fake.handler = async () => ({ stdout: EMPTY_LIST });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('gives listings that run at the same time different, new and empty folders under the temp folder', async () => {
    const seen: Array<{ folder: string; existed: boolean; entries: number }> = [];
    let started = 0;
    let release: () => void = () => undefined;
    const allStarted = new Promise<void>((resolveAll) => {
      release = resolveAll;
    });
    fake.handler = async (options) => {
      const folder = cacheFolderOf(options);
      seen.push({ folder, existed: existsSync(folder), entries: existsSync(folder) ? readdirSync(folder).length : -1 });
      started += 1;
      if (started === 3) release();
      // No listing finishes until all three are in flight, as the guard files' `beforeAll` hooks overlap in the real run.
      await allStarted;
      return { stdout: EMPTY_LIST };
    };

    await Promise.all([listPlaywrightSuites(), listPlaywrightSuites(), listPlaywrightSuites({ index: 1, total: 3 })]);

    expect(seen).toHaveLength(3);
    expect(new Set(seen.map((entry) => entry.folder)).size).toBe(3);
    for (const entry of seen) {
      expect(entry.existed, entry.folder).toBe(true);
      expect(entry.entries, entry.folder).toBe(0);
      expect(resolve(dirname(entry.folder)), entry.folder).toBe(resolve(tmpdir()));
    }
  });

  it('removes the folder when the listing has finished (it existed while the listing ran)', async () => {
    let folder = '';
    let existedDuringListing = false;
    fake.handler = async (options) => {
      folder = cacheFolderOf(options);
      existedDuringListing = existsSync(folder);
      return { stdout: EMPTY_LIST };
    };
    await listPlaywrightSuites();
    // Without the first check, the second would also pass for a helper that never made a folder, or that reused a fixed one
    // some other file had already removed (QLT-01).
    expect(existedDuringListing).toBe(true);
    expect(existsSync(folder)).toBe(false);
  });

  it('removes the folder when the listing fails, and still reports why it failed (it existed while the listing ran)', async () => {
    let folder = '';
    let existedDuringListing = false;
    fake.handler = async (options) => {
      folder = cacheFolderOf(options);
      existedDuringListing = existsSync(folder);
      throw Object.assign(new Error('boom'), { code: 1, stderr: 'a spec did not compile' });
    };
    await expect(listPlaywrightSuites()).rejects.toThrow(/playwright test --list failed \(exit 1\)[\s\S]*a spec did not compile/);
    expect(existedDuringListing).toBe(true);
    expect(existsSync(folder)).toBe(false);
  });

  it('keeps the rest of the environment, and takes the cache folder from the listing and not from the caller', async () => {
    const callerFolder = 'a-shared-folder-the-caller-set';
    vi.stubEnv('AQP_236_PROBE', 'kept');
    vi.stubEnv(CACHE_DIR_VARIABLE, callerFolder);
    let environment: NodeJS.ProcessEnv | undefined;
    let existedDuringListing = false;
    fake.handler = async (options) => {
      environment = options.env;
      existedDuringListing = existsSync(cacheFolderOf(options));
      return { stdout: EMPTY_LIST };
    };
    await listPlaywrightSuites();
    expect(environment?.['AQP_236_PROBE']).toBe('kept');
    const folder = environment?.[CACHE_DIR_VARIABLE] ?? '';
    // `not.toBe(callerFolder)` alone passes for any other folder, a fixed shared one included. The anchored name is the one
    // `mkdtemp` makes for this helper: the prefix and six random characters (QLT-02).
    expect(folder).not.toBe(callerFolder);
    expect(basename(folder)).toMatch(/^accucut-playwright-list-[A-Za-z0-9]{6}$/);
    expect(existedDuringListing).toBe(true);
    expect(existsSync(folder)).toBe(false);
  });
});

describe('AQP-236 (DEF-022): withPrivateListCache', () => {
  it('returns what the work returns, with a folder that exists while it runs and not after', async () => {
    let folder = '';
    const result = await withPrivateListCache(async (cacheDirectory) => {
      folder = cacheDirectory;
      expect(existsSync(cacheDirectory)).toBe(true);
      return 'listed';
    });
    expect(result).toBe('listed');
    expect(existsSync(folder)).toBe(false);
  });

  it('passes on the error the work threw, and removes the folder', async () => {
    let folder = '';
    await expect(
      withPrivateListCache(async (cacheDirectory) => {
        folder = cacheDirectory;
        throw new Error('the work failed');
      }),
    ).rejects.toThrow('the work failed');
    expect(existsSync(folder)).toBe(false);
  });
});
