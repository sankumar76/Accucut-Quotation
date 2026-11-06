import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { z } from 'zod';

/**
 * Asks Playwright itself which E2E tests exist (`playwright test --list --reporter=json`), whole or for one shard, and
 * checks the shape of the answer with zod, so a test never casts it. Shared by `one-width-tag.test.ts` (AQP-199) and
 * `e2e-shards.test.ts` (AQP-208). Listing needs no browser and no server, but it loads the TypeScript config and every
 * spec, which takes several seconds (about ten on a Windows checkout), so callers list once in `beforeAll`, under the
 * shared hook limit (vitest.config.ts, DL-057), and the tests read the result.
 */

const run = promisify(execFile);
const REPOSITORY_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const PLAYWRIGHT_CLI = createRequire(import.meta.url).resolve('@playwright/test/cli');

/**
 * How long one listing may run before it is stopped. It is below the hook limit (120 s), so a hung listing fails with its
 * own message instead of the hook's.
 */
const LIST_TIMEOUT_MS = 100_000;
/** How much of the child's output goes into an error message. */
const OUTPUT_TAIL = 2_000;

export interface ListedSpec {
  readonly title: string;
  readonly file: string;
  readonly line: number;
  readonly tags?: ReadonlyArray<string> | undefined;
  readonly tests: ReadonlyArray<{ readonly projectName: string }>;
}

export interface ListedSuite {
  readonly title: string;
  readonly specs?: ReadonlyArray<ListedSpec> | undefined;
  readonly suites?: ReadonlyArray<ListedSuite> | undefined;
}

const specSchema = z.object({
  title: z.string(),
  file: z.string(),
  line: z.number(),
  tags: z.array(z.string()).optional(),
  tests: z.array(z.object({ projectName: z.string() })),
});
const suiteSchema: z.ZodType<ListedSuite> = z.lazy(() =>
  z.object({ title: z.string(), specs: z.array(specSchema).optional(), suites: z.array(suiteSchema).optional() }),
);
const listSchema = z.object({ suites: z.array(suiteSchema) });

const tail = (text: string): string => (text.length > OUTPUT_TAIL ? `...${text.slice(-OUTPUT_TAIL)}` : text).trim();

/** What a failed child process carries, read without a cast. */
const failureSchema = z.object({
  code: z.union([z.number(), z.string()]).nullish(),
  signal: z.string().nullish(),
  killed: z.boolean().optional(),
  message: z.string().optional(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
});

/**
 * The suites Playwright lists, for the whole run or for `--shard=<index>/<total>`. A listing that fails says why: its exit
 * status or signal, whether it was stopped for taking too long, and the tail of what it wrote to stderr and stdout
 * (QLT-86: an earlier failure of this kind left no trace).
 */
export async function listPlaywrightSuites(shard?: { readonly index: number; readonly total: number }): Promise<ListedSuite[]> {
  const label = shard === undefined ? 'playwright test --list' : `playwright test --list --shard=${shard.index}/${shard.total}`;
  const args = [PLAYWRIGHT_CLI, 'test', '--list', '--reporter=json', ...(shard === undefined ? [] : [`--shard=${shard.index}/${shard.total}`])];
  let stdout: string;
  try {
    ({ stdout } = await run(process.execPath, args, { cwd: REPOSITORY_ROOT, maxBuffer: 64 * 1024 * 1024, timeout: LIST_TIMEOUT_MS }));
  } catch (error) {
    const failure = failureSchema.safeParse(error);
    const detail = failure.success ? failure.data : {};
    const how = [
      detail.code === undefined || detail.code === null ? '' : `exit ${String(detail.code)}`,
      detail.signal === undefined || detail.signal === null ? '' : `signal ${detail.signal}`,
      detail.killed === true ? `stopped after ${LIST_TIMEOUT_MS / 1_000} s` : '',
    ].filter((part) => part !== '');
    throw new Error(
      `${label} failed (${how.join(', ') || detail.message || 'no status'})\nstderr: ${tail(detail.stderr ?? '') || '(empty)'}\nstdout: ${tail(detail.stdout ?? '') || '(empty)'}`,
    );
  }
  let json: unknown;
  try {
    json = JSON.parse(stdout);
  } catch {
    throw new Error(`${label} printed output that is not JSON\nstdout: ${tail(stdout) || '(empty)'}`);
  }
  const parsed = listSchema.safeParse(json);
  if (!parsed.success) throw new Error(`${label} printed JSON in an unexpected shape: ${parsed.error.message.slice(0, OUTPUT_TAIL)}`);
  return parsed.data.suites;
}

/**
 * Calls `visit` for every spec, with the titles of the `describe` blocks around it. The first level of suites is the
 * file, which `spec.file` names already, so it is not part of `blocks`.
 */
export function forEachSpec(suites: ReadonlyArray<ListedSuite>, visit: (spec: ListedSpec, blocks: ReadonlyArray<string>) => void): void {
  const walk = (suite: ListedSuite, blocks: ReadonlyArray<string>): void => {
    for (const spec of suite.specs ?? []) visit(spec, blocks);
    for (const child of suite.suites ?? []) walk(child, [...blocks, child.title]);
  };
  for (const file of suites) walk(file, []);
}
