import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * AC-8 (CONSTRAINT-02, NFR-002, TB-2): formula text never reaches a client bundle. Every `src/lib/formula/**` file
 * starts with `import 'server-only'`, so a client component that imports the engine fails the build.
 *
 * Two real `next build` runs over small fixture apps in `tests/fixtures/server-only-build/`:
 * - `client-import`: a `'use client'` page imports the engine. The build must fail, naming `server-only`.
 * - `server-import`: a server page imports the same module. The build must succeed. This control shows that the
 *   first failure is about `server-only` and not about something else in the engine or the setup.
 *
 * Each build takes tens of seconds, so both run once in the `beforeAll` hook, with the hook's own timeout
 * (test strategy section 10); the tests then only read what they printed.
 */

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const FIXTURES = `${ROOT}tests/fixtures/server-only-build/`;
const NEXT = `${ROOT}node_modules/next/dist/bin/next`;
const BUILD_HOOK_TIMEOUT = 300_000;
/** Files Next writes into a fixture when it first sees TypeScript there. None is tracked. */
const GENERATED = ['.next', 'tsconfig.json', 'next-env.d.ts'];

interface BuildResult {
  readonly status: number | null;
  readonly output: string;
}

function build(fixture: string): Promise<BuildResult> {
  // `NODE_ENV` is "test" inside Vitest, but a build runs as production. The child opens no database.
  // Plain text output: Next's colour codes would split the message that the test looks for. A set FORCE_COLOR
  // turns colour on whatever its value, so it is left out rather than set to 0.
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([name]) => name !== 'FORCE_COLOR'));
  const env = { ...inherited, NODE_ENV: 'production' as const, NEXT_TELEMETRY_DISABLED: '1', NO_COLOR: '1' };
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [NEXT, 'build', `${FIXTURES}${fixture}`], { cwd: ROOT, env });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, output }));
  });
}

function clean(): void {
  for (const fixture of ['client-import', 'server-import']) {
    for (const name of GENERATED) rmSync(`${FIXTURES}${fixture}/${name}`, { recursive: true, force: true });
  }
}

describe('server-only in a real build (AC-8)', () => {
  let client: BuildResult;
  let server: BuildResult;

  beforeAll(async () => {
    clean();
    // One after the other: two Next builds from one repository root share caches and are not safe to overlap.
    client = await build('client-import');
    server = await build('server-import');
  }, BUILD_HOOK_TIMEOUT);
  afterAll(clean);

  it('AC-8: a client component that imports the engine fails the build, and the error names server-only', () => {
    expect(client.status).not.toBe(0);
    expect(client.output).toContain("'server-only' cannot be imported from a Client Component module");
    expect(client.output).toMatch(/src[\\/]lib[\\/]formula[\\/]/);
  });

  it('AC-8: a server component that imports the same engine builds', () => {
    expect(server.output).not.toContain('server-only');
    expect(server.status).toBe(0);
  });
});
