import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';

import { register } from '@/instrumentation';
import { ENV_VARIABLE_NAMES, loadAppEnv } from '@/lib/env';
import { logger } from '@/lib/logger';

// Wrap the real loader so one test can make it fail in a way that is not an environment problem.
vi.mock('@/lib/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/env')>();
  return { ...actual, loadAppEnv: vi.fn(actual.loadAppEnv) };
});

/**
 * AC-3, DEF-001, QLT-15: an invalid environment must stop the server at start-up. Next.js catches an
 * error thrown by `register()` and keeps serving HTTP 500, so `register()` writes one line naming the
 * variables and exits the process with code 1, which a supervisor sees as a failed start.
 */

class ExitCalled extends Error {
  constructor(readonly code: number | string | null | undefined) {
    super(`process.exit(${String(code)})`);
  }
}

const PLANTED_VALUE = 'planted-short-secret';

/** An empty environment for the settings the app reads. An empty value counts as missing. */
function stubEmptyEnvironment(): void {
  for (const name of ENV_VARIABLE_NAMES) vi.stubEnv(name, '');
}

function stubCompleteEnvironment(): void {
  vi.stubEnv('DATABASE_URL', 'postgresql://accucut_app:invented-password@localhost:55432/accucut');
  vi.stubEnv('AUTH_SECRET', 'invented-start-up-secret-0123456789-abcdef');
  vi.stubEnv('APP_ORIGIN', 'http://localhost:3000');
  vi.stubEnv('SMTP_HOST', 'localhost');
  vi.stubEnv('SMTP_PORT', '1025');
  vi.stubEnv('SMTP_AUTH_MODE', 'none');
}

let exit: MockInstance<typeof process.exit>;
let stderr: MockInstance<typeof process.stderr.write>;

beforeEach(() => {
  // Throwing stops the code after process.exit, as the real exit does, without ending the test run.
  exit = vi.spyOn(process, 'exit').mockImplementation((code) => {
    throw new ExitCalled(code);
  });
  stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function written(): string {
  return stderr.mock.calls.map(([chunk]) => String(chunk)).join('');
}

describe('register (start-up check)', () => {
  it('DEF-001: exits with code 1, exactly once, when a required variable is missing', async () => {
    stubEmptyEnvironment();
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('NEXT_PHASE', 'phase-production-server');
    await expect(register()).rejects.toThrow(ExitCalled);
    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('DEF-001: writes one line to stderr that names the variables', async () => {
    stubEmptyEnvironment();
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('NEXT_PHASE', 'phase-production-server');
    await expect(register()).rejects.toThrow(ExitCalled);
    const output = written();
    expect(output.trimEnd().split('\n')).toHaveLength(1);
    expect(output).toContain('DATABASE_URL (missing)');
    expect(output).toContain('AUTH_SECRET (missing)');
    expect(output).toContain('Invalid environment');
  });

  it('DEF-001, AC-3: never prints a value, including a planted invalid one', async () => {
    stubEmptyEnvironment();
    vi.stubEnv('AUTH_SECRET', PLANTED_VALUE);
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('NEXT_PHASE', 'phase-production-server');
    await expect(register()).rejects.toThrow(ExitCalled);
    expect(written()).toContain('AUTH_SECRET (invalid)');
    expect(written()).not.toContain(PLANTED_VALUE);
  });

  it('re-throws an error that is not about the environment, unchanged, and does not exit', async () => {
    const unexpected = new Error('unexpected failure');
    vi.mocked(loadAppEnv).mockImplementationOnce(() => {
      throw unexpected;
    });
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('NEXT_PHASE', 'phase-production-server');
    await expect(register()).rejects.toThrow(unexpected);
    expect(exit).not.toHaveBeenCalled();
    expect(written()).toBe('');
  });

  it('does nothing outside the Node.js runtime (edge)', async () => {
    stubEmptyEnvironment();
    vi.stubEnv('NEXT_RUNTIME', 'edge');
    await expect(register()).resolves.toBeUndefined();
    expect(exit).not.toHaveBeenCalled();
  });

  it('does nothing while next build runs, which has no runtime settings', async () => {
    stubEmptyEnvironment();
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('NEXT_PHASE', 'phase-production-build');
    await expect(register()).resolves.toBeUndefined();
    expect(exit).not.toHaveBeenCalled();
  });

  it('passes with a complete environment, and neither exits nor writes', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('NEXT_PHASE', 'phase-production-server');
    stubCompleteEnvironment();
    await expect(register()).resolves.toBeUndefined();
    expect(exit).not.toHaveBeenCalled();
    expect(written()).toBe('');
  });
});

/**
 * AQP-487 (DEF-130): a production server whose export thread bundle (`.next/export-worker.mjs`) is missing says so once at start-up, as one structured `error` record with the code `EXPORT_THREAD_MISSING`, naming the command to run for
 * a source folder and for an installed release, and goes on serving. It does not exit. Anywhere but production (development makes the bundle itself; the tests run under `test`) it writes nothing. The folder is a scratch one, made for each
 * test and removed after it.
 */
describe('register (the export thread bundle, DEF-130)', () => {
  const folders: string[] = [];
  let error: MockInstance<typeof logger.error>;

  beforeEach(() => {
    error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
  });

  function inScratchFolder(withBundle: boolean): string {
    const folder = mkdtempSync(join(tmpdir(), 'accucut-register-'));
    folders.push(folder);
    if (withBundle) {
      mkdirSync(join(folder, '.next'));
      writeFileSync(join(folder, '.next', 'export-worker.mjs'), '// invented');
    }
    vi.spyOn(process, 'cwd').mockReturnValue(folder);
    return folder;
  }

  function startAs(nodeEnv: string): void {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('NEXT_PHASE', 'phase-production-server');
    vi.stubEnv('NODE_ENV', nodeEnv);
    stubCompleteEnvironment();
  }

  it('writes one error record, with the code, that names the file, the folder and both commands, and neither exits nor throws, when a production server has no bundle', async () => {
    const folder = inScratchFolder(false);
    startAs('production');
    await expect(register()).resolves.toBeUndefined();
    expect(exit).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(1);
    const [fields, message] = error.mock.calls[0] ?? [];
    expect(fields).toEqual({ code: 'EXPORT_THREAD_MISSING' });
    expect(String(message)).toContain('export-worker.mjs');
    expect(String(message)).toContain(folder);
    // A source folder (a demo, a development copy) and an installed Windows release, which has no npm and no source (QLT-799-02).
    expect(String(message)).toContain('npx tsx scripts/build-export-worker.ts');
    expect(String(message)).toContain('C:\\Accucut\\current\\update.ps1');
    expect(String(message)).not.toContain('\n');
  });

  it('writes nothing when the production server has its bundle', async () => {
    inScratchFolder(true);
    startAs('production');
    await register();
    expect(error).not.toHaveBeenCalled();
    expect(written()).toBe('');
  });

  it.each(['development', 'test'])('writes nothing in %s, where the bundle is not this check\'s business', async (nodeEnv) => {
    inScratchFolder(false);
    startAs(nodeEnv);
    await register();
    expect(error).not.toHaveBeenCalled();
  });

  it('does not ask for the bundle while `next build` runs, which has no runtime settings and no bundle yet', async () => {
    inScratchFolder(false);
    startAs('production');
    vi.stubEnv('NEXT_PHASE', 'phase-production-build');
    await register();
    expect(error).not.toHaveBeenCalled();
  });

  it('never stops the start: a logger that throws changes nothing', async () => {
    inScratchFolder(false);
    startAs('production');
    error.mockImplementation(() => {
      throw new Error('the log is full');
    });
    await expect(register()).resolves.toBeUndefined();
    expect(exit).not.toHaveBeenCalled();
  });
});

describe('src/instrumentation.ts and the Edge bundle (QLT-799-01)', () => {
  it('imports nothing at the top that reaches a Node module: the export check and the logger are loaded inside the Node branch', () => {
    const source = readFileSync(fileURLToPath(new URL('../../src/instrumentation.ts', import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
    const staticImports = [...source.matchAll(/^import .* from '([^']+)';$/gm)].map((match) => match[1]);
    // `thread-runner` imports `node:fs`, `node:path` and `node:worker_threads`: statically imported here it is compiled into the Edge instrumentation bundle and prints three build warnings.
    expect(staticImports.sort()).toEqual(['@/lib/env', 'next']);
    expect(source).toContain("await import('@/server/export/thread-runner')");
  });
});
