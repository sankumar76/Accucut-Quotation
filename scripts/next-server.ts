/**
 * Starts the production server (`next start`) for a measurement and stops it afterwards. Used by the JS budget check
 * (STORY-10.10 AC-1: "served by `npx next start` on a free port"). Every setting is invented for the run, so the
 * server needs no real secret and cannot be mistaken for a deployment.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';

const READY_TIMEOUT_MS = 90_000;
const POLL_INTERVAL_MS = 250;
const OUTPUT_TAIL_LINES = 15;
const SECRET_BYTES = 32;
const SMTP_PORT = '1025';
/** Only to let the server start when no database is configured (a build whose pages never ask for one). */
const INVENTED_DATABASE_URL = 'postgresql://accucut_app:invented-password@localhost:5432/accucut';
/** What the child needs from the machine to start: the program path and the temp folders. Nothing else is passed on. */
const PASSED_THROUGH = ['PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP', 'HOME', 'USERPROFILE'];

/** A port nothing is listening on right now. */
export function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close(() => (address !== null && typeof address === 'object' ? resolvePort(address.port) : reject(new Error('no port was assigned'))));
    });
  });
}

/** The settings the server's start-up check needs (src/lib/env.ts). Invented, except the database address the job already holds. */
export function serverEnvironment(origin: string, parent: Readonly<Record<string, string | undefined>>): NodeJS.ProcessEnv {
  const passed = Object.fromEntries(PASSED_THROUGH.flatMap((name) => (parent[name] === undefined ? [] : [[name, parent[name]]])));
  return {
    ...passed,
    NODE_ENV: 'production',
    NEXT_TELEMETRY_DISABLED: '1',
    DATABASE_URL: parent['DATABASE_URL'] ?? INVENTED_DATABASE_URL,
    AUTH_SECRET: randomBytes(SECRET_BYTES).toString('hex'),
    APP_ORIGIN: origin,
    SMTP_HOST: 'localhost',
    SMTP_PORT,
    SMTP_AUTH_MODE: 'none',
  };
}

export interface RunningServer {
  readonly baseUrl: string;
  stop(): Promise<void>;
}

/** The Next.js program of the build's own folder when it has one (a build made in another worktree), else this repository's. */
function nextProgram(buildDir: string): string {
  const own = resolve(buildDir, 'node_modules', 'next', 'dist', 'bin', 'next');
  return existsSync(own) ? own : resolve('node_modules', 'next', 'dist', 'bin', 'next');
}

async function waitUntilAnswering(baseUrl: string, child: ChildProcess, output: string[]): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`the server stopped with code ${child.exitCode} before it answered:\n${output.slice(-OUTPUT_TAIL_LINES).join('\n')}`);
    try {
      await fetch(`${baseUrl}/`, { redirect: 'manual', signal: AbortSignal.timeout(POLL_INTERVAL_MS * 8) });
      return;
    } catch {
      await new Promise((done) => setTimeout(done, POLL_INTERVAL_MS));
    }
  }
  throw new Error(`the server did not answer within ${READY_TIMEOUT_MS / 1000} s:\n${output.slice(-OUTPUT_TAIL_LINES).join('\n')}`);
}

/** Starts `next start` for the build in `buildDir` on a free port and waits until it answers. */
export async function startNextServer(buildDir: string, parent: Readonly<Record<string, string | undefined>>): Promise<RunningServer> {
  const port = await freePort();
  const baseUrl = `http://localhost:${port}`;
  const child = spawn(process.execPath, [nextProgram(buildDir), 'start', '--port', String(port)], {
    cwd: resolve(buildDir),
    env: serverEnvironment(baseUrl, parent),
  });
  const output: string[] = [];
  const collect = (chunk: Buffer): void => void output.push(...chunk.toString().split('\n').filter((line) => line.trim() !== ''));
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);
  const stop = (): Promise<void> =>
    new Promise((done) => {
      if (child.exitCode !== null) return done();
      child.once('close', () => done());
      child.kill();
    });
  try {
    await waitUntilAnswering(baseUrl, child, output);
  } catch (error) {
    await stop();
    throw error;
  }
  return { baseUrl, stop };
}
