import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { freePort, serverEnvironment, startNextServer, type RunningServer } from '../../scripts/next-server';

/**
 * STORY-10.10 AC-1: "served by `npx next start` on a free port". The server starter is run against a stand-in for the
 * Next.js program (a few lines of Node in a fixture folder), so no build is needed: it must pick a free port, hand the
 * program only invented settings, wait until the server answers, report a server that dies, and stop it.
 */

let root: string;
let working: string;
let failing: string;
const seenSchema = z.object({ env: z.record(z.string(), z.string().optional()) });
let running: RunningServer | undefined;
let started: { readonly baseUrl: string; readonly answered: boolean; readonly environment: Record<string, string | undefined> };
let afterStop: boolean;
let failure: unknown;

/** A stand-in for `node_modules/next/dist/bin/next`: `start --port N` listens and answers 200, and records its settings. */
const WORKING_PROGRAM = `
const http = require('node:http');
const fs = require('node:fs');
const port = Number(process.argv[process.argv.indexOf('--port') + 1]);
fs.writeFileSync('seen-environment.json', JSON.stringify({ argv: process.argv.slice(2), env: process.env }));
http.createServer((request, response) => { response.writeHead(200); response.end('ok'); }).listen(port, '127.0.0.1');
`;
const FAILING_PROGRAM = `
process.stderr.write('Error: invented start-up failure\\n');
process.exit(3);
`;

function fixture(name: string, program: string): string {
  const directory = join(root, name);
  const bin = join(directory, 'node_modules', 'next', 'dist', 'bin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, 'next'), program);
  return directory;
}

function isListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once('error', () => resolve(true));
    probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(false)));
  });
}

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'next-server-'));
  working = fixture('working', WORKING_PROGRAM);
  failing = fixture('failing', FAILING_PROGRAM);

  const parent = { PATH: process.env['PATH'], DATABASE_URL: 'postgresql://accucut_app:invented@localhost:5432/accucut', LEAKED_SETTING: 'must-not-reach-the-server' };
  running = await startNextServer(working, parent);
  const answered = (await fetch(`${running.baseUrl}/`)).status === 200;
  const seen = seenSchema.parse(JSON.parse(readFileSync(join(working, 'seen-environment.json'), 'utf8')));
  started = { baseUrl: running.baseUrl, answered, environment: seen.env };
  const port = Number(new URL(running.baseUrl).port);
  await running.stop();
  running = undefined;
  afterStop = !(await isListening(port));

  failure = await startNextServer(failing, parent).catch((error: unknown) => error);
}, 120_000);

afterAll(async () => {
  await running?.stop();
  rmSync(root, { recursive: true, force: true });
});

describe('startNextServer', () => {
  it('starts the build\'s own Next.js program on a free port and waits until the server answers', () => {
    expect(started.baseUrl).toMatch(/^http:\/\/localhost:\d+$/);
    expect(started.answered).toBe(true);
  });

  it('gives the server production mode and invented settings, the job\'s database address, and nothing else from the machine', () => {
    const { environment, baseUrl } = started;
    expect(environment['NODE_ENV']).toBe('production');
    expect(environment['APP_ORIGIN']).toBe(baseUrl);
    expect(environment['DATABASE_URL']).toBe('postgresql://accucut_app:invented@localhost:5432/accucut');
    expect(environment['AUTH_SECRET']?.length).toBeGreaterThanOrEqual(32);
    expect(environment['LEAKED_SETTING']).toBeUndefined();
  });

  it('stops the server: its port is free again', () => {
    expect(afterStop).toBe(true);
  });

  it('rejects, with the last lines the server printed, when it stops before it answers', () => {
    const message = failure instanceof Error ? failure.message : '(not an error)';
    expect(message).toContain('the server stopped with code 3 before it answered');
    expect(message).toContain('invented start-up failure');
  });
});

describe('freePort and serverEnvironment', () => {
  it('finds a port nothing listens on', async () => {
    const port = await freePort();
    expect(port).toBeGreaterThan(0);
    expect(await isListening(port)).toBe(false);
  });

  it('uses an invented database address when the job holds none, and a new secret each time', () => {
    const first = serverEnvironment('http://localhost:1', { PATH: 'p' });
    const second = serverEnvironment('http://localhost:1', { PATH: 'p' });
    expect(first['DATABASE_URL']).toContain('invented-password');
    expect(first['AUTH_SECRET']).not.toBe(second['AUTH_SECRET']);
    expect(first['PATH']).toBe('p');
  });
});
