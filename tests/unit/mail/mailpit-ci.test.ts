import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * STORY-09.01 AC-9 and the conditions of master's ruling DL-238 on AQP-348 (Jira comment 12214): the capturing mail server is pinned by version AND digest, with the same pin in
 * `compose.dev.yml` and in `.github/workflows/ci.yml`; it is one `services:` entry of the existing `verify` job and nowhere else (no new or renamed job, none in the E2E shards);
 * the required check keeps its name `Stages 1 to 11`; and the service holds no secret. A workflow cannot run in a unit test, so the files are read as text, as the other CI tests do.
 */

const read = (path: string): string => readFileSync(fileURLToPath(new URL(`../../../${path}`, import.meta.url)), 'utf8').replaceAll('\r\n', '\n');
const CI = read('.github/workflows/ci.yml');
const COMPOSE = read('compose.dev.yml');

const PIN = /image:\s*(axllent\/mailpit:v\d+\.\d+\.\d+@sha256:[0-9a-f]{64})\s*$/gm;

function pinsIn(text: string): string[] {
  return [...text.matchAll(PIN)].map((match) => match[1] ?? '');
}

/** The text of one top-level job of the workflow: from its key to the next job's key. */
function jobText(job: string): string {
  const jobs = CI.slice(CI.indexOf('\njobs:\n'));
  const start = jobs.indexOf(`\n  ${job}:\n`);
  if (start === -1) throw new Error(`No job ${job}`);
  const next = /\n {2}[A-Za-z0-9_-]+:\n/g;
  // Starts one character past the job's own key line break, so the first match is the next job.
  next.lastIndex = start + 1;
  const end = next.exec(jobs)?.index ?? jobs.length;
  return jobs.slice(start, end);
}

describe('the Mailpit pin (AC-9, DL-238 condition 1)', () => {
  it('compose.dev.yml and ci.yml each pin Mailpit once, by version and digest, to the same image', () => {
    expect(pinsIn(COMPOSE)).toHaveLength(1);
    expect(pinsIn(CI)).toHaveLength(1);
    expect(pinsIn(CI)).toEqual(pinsIn(COMPOSE));
  });

  it('no other reference to the image, so a tag without a digest cannot slip in', () => {
    for (const text of [COMPOSE, CI]) expect([...text.matchAll(/axllent\/mailpit[^\s]*/g)].map((match) => match[0])).toEqual([...pinsIn(text)].map((pin) => pin));
  });

  it('the pinned release is v1.33.0, published on 2026-10-31, more than two weeks before this story (2026-11-18)', () => {
    expect(pinsIn(CI)[0]).toMatch(/^axllent\/mailpit:v1\.33\.0@/);
  });
});

describe('where the service lives (AC-9, DL-238)', () => {
  it('is a `services:` entry of the verify job only', () => {
    const verify = jobText('verify');
    expect(verify).toContain('\n    services:\n');
    expect(verify.slice(verify.indexOf('\n    services:\n'), verify.indexOf('\n    steps:\n'))).toContain('\n      mailpit:\n');
    for (const job of [...CI.matchAll(/\n {2}([A-Za-z0-9_-]+):\n {4}(?:name|runs-on|needs|if):/g)].map((match) => match[1] ?? '')) {
      if (job !== 'verify') expect(jobText(job), `job ${job}`).not.toContain('mailpit');
    }
  });

  it('keeps the job names: the required check is `Stages 1 to 11` (the fan-in), and verify is `Stages 1 to 11b`', () => {
    expect(CI).toMatch(/\n {4}name: Stages 1 to 11\n/);
    expect(jobText('verify')).toContain('name: Stages 1 to 11b');
  });

  it('has no secret in the service entry: no password, token or credential', () => {
    const verify = jobText('verify');
    const mailpit = verify.slice(verify.indexOf('\n      mailpit:\n'), verify.indexOf('\n    steps:\n'));
    expect(mailpit).not.toMatch(/password|secret|token|credential|MP_UI_AUTH|MP_SMTP_AUTH/i);
  });

  it('the integration step gets the two variables that point the tests at it', () => {
    expect(CI).toContain('MAILPIT_API_URL: http://127.0.0.1:8025');
    expect(CI).toContain('MAILPIT_SMTP_PORT: "1025"');
  });
});
