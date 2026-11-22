import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * STORY-10.09 AC-8 (NFR-012, Q-18, architecture A-02): `deploy/windows/README.md` has the section "Uptime monitor" for the IT person. It must give the path, the healthy answer, what a 503 means,
 * the 5-minute interval, who receives the alerts and the plan-terms note, and it must say that setting the monitor up is not a condition for a release. The health route's own answers are held by
 * `health-route.test.ts`; this test holds that the README says the same things.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const README = readFileSync(`${ROOT}deploy/windows/README.md`, 'utf8').replaceAll('\r\n', '\n');

function section(): string {
  const start = README.indexOf('\n## Uptime monitor');
  expect(start, 'the README has no "Uptime monitor" section').toBeGreaterThan(-1);
  const rest = README.slice(start + 1);
  const end = rest.indexOf('\n## ', 1);
  return end === -1 ? rest : rest.slice(0, end);
}

describe('AC-8: the section "Uptime monitor" of the Windows README', () => {
  const text = section();

  it('is titled "Uptime monitor" and sits between "Look and fix" and "Backups"', () => {
    expect(README.indexOf('\n## Look and fix')).toBeLessThan(README.indexOf('\n## Uptime monitor'));
    expect(README.indexOf('\n## Uptime monitor')).toBeLessThan(README.indexOf('\n## Backups'));
  });

  it('gives the path /api/health, the healthy answer 200 with {"status":"ok"}, and the 5-minute interval', () => {
    expect(text).toContain('`/api/health`');
    expect(text).toContain('HTTP **200**');
    expect(text).toContain('{"status":"ok"}');
    expect(text).toMatch(/\*\*5 minutes\*\*/);
  });

  it('says what a 503 means (the database or a stopped worker, never which) and what to do', () => {
    expect(text).toContain('**503**');
    expect(text).toContain('{"status":"unavailable"}');
    expect(text).toMatch(/\*\*database\*\* did not answer, or the \*\*worker\*\* has stopped/);
    expect(text).toContain('never says which');
    expect(text).toContain('Get-Service AccucutApp, AccucutWorker, postgresql-x64-17');
  });

  it('names who receives the alerts: the IT person, by e-mail, and not the portal\'s own e-mail', () => {
    expect(text).toMatch(/Who receives the alerts \| \*\*The IT person/);
    expect(text).toContain('The portal\'s own e-mail cannot be the alert route');
  });

  it('carries the plan-terms note of A-02: UptimeRobot, the free plan\'s business use to be checked, any 5-minute monitor will do', () => {
    expect(text).toContain('UptimeRobot');
    expect(text).toMatch(/free plan allows business use/);
    expect(text).toMatch(/Accucut IT must read the current terms/);
    expect(text).toMatch(/Any external HTTP monitor with a \*\*5-minute\*\* interval meets NFR-012/);
  });

  it('says that setting it up is a human step after go-live and not a condition for a release, and that it waits for the web address (Q-18)', () => {
    expect(text).toContain('human step for the IT person after go-live');
    expect(text).toContain('not a condition for accepting a release');
    expect(text).toContain('Q-18');
  });

  it('holds no real web address: the example address is on the reserved example.test domain', () => {
    const addresses = [...text.matchAll(/https?:\/\/[^\s`)]+/g)].map((match) => match[0]);
    for (const address of addresses) expect(address, address).toMatch(/example\.test|127\.0\.0\.1/);
  });
});
