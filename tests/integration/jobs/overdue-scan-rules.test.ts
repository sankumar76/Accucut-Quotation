import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaClient } from '../../../src/generated/prisma/client';
import { MILLISECONDS_PER_HOUR, MILLISECONDS_PER_MINUTE } from '@/lib/time';
import { performOverdueScan, runOverdueScan, type OverdueScanStore } from '@/server/jobs/overdue-scan';
import { runJob, type JobLogFields, type JobLogLevel } from '@/server/jobs/run-job';
import { LOGO_CONTENT_ID } from '@/server/mail/layout';
import { createOverdueScanStore } from '@/server/repositories/overdue-repository';

import { forbiddenStrings } from '../../support/canary-masters';
import { defined } from '../../support/defined';
import {
  addressOf,
  ago,
  clock,
  closeWorld,
  db,
  engineerId,
  jobRuns,
  leadId,
  messagesFor,
  minute,
  NOW,
  openWorld,
  ORIGIN,
  outboxRows,
  PATH,
  reserveCodes,
  resetWorld,
  scan,
  scanDependencies,
  seed,
  send,
  setAlerts,
  store,
} from '../../support/overdue-world';
import { testPoolConfig } from '../../support/test-prisma-client';

/**
 * STORY-09.04 AC-6 to AC-9 against real PostgreSQL, the real scan, the real outbox and a capturing mail server (see `overdue-scan.test.ts` and `tests/support/overdue-world.ts`).
 *   AC-6 alerts OFF writes nothing; the 24-hour window, at 23 h 59 min and at 24 h 1 min.
 *   AC-7 the words, the IST deadline, escaping, and no canary value.
 *   AC-8 the `job_runs` rows: ok with the counts, none for an empty run, failed for a failure.
 *   AC-9 the number of statements does not grow with the number of tasks beyond the enqueue statements.
 * Every name, address, path and date is invented.
 */

beforeAll(() => openWorld(1));
afterAll(closeWorld);
beforeEach(resetWorld);

describe('AC-6 (BR-040): alerts OFF, and the 24-hour window', () => {
  it('writes no row and no job_runs row while alerts are OFF', async () => {
    await seed({ deadline: ago(5 * MILLISECONDS_PER_MINUTE) });
    await setAlerts(false);
    for (let run = 0; run < 3; run += 1) {
      await scan();
      clock.advance(MILLISECONDS_PER_MINUTE);
    }
    expect(await outboxRows()).toHaveLength(0);
    expect(await jobRuns()).toEqual([]);
  });

  it('a task overdue for 23 h 59 min when alerts are switched ON is reported once, right after; one overdue for 24 h 1 min never is', async () => {
    const deadline = ago(23 * MILLISECONDS_PER_HOUR + 59 * MILLISECONDS_PER_MINUTE);
    const old = ago(24 * MILLISECONDS_PER_HOUR + MILLISECONDS_PER_MINUTE);
    const recent = await seed({ deadline });
    const stale = await seed({ deadline: old });
    await setAlerts(false);
    await minute();
    expect(await outboxRows()).toHaveLength(0);

    await setAlerts(true);
    await minute();
    expect(await messagesFor(recent.code)).toHaveLength(1);
    expect(await messagesFor(stale.code)).toHaveLength(0);

    // Later scans, past the window of the first task as well: still once.
    clock.advance(2 * MILLISECONDS_PER_MINUTE);
    await minute();
    expect(await messagesFor(recent.code)).toHaveLength(1);
    expect(await outboxRows()).toHaveLength(1);
  });

  it('a row written while alerts were ON and not yet sent is skipped when they are switched OFF before it is claimed (09.01)', async () => {
    const task = await seed({ deadline: ago(MILLISECONDS_PER_MINUTE) });
    await scan();
    await setAlerts(false);
    await send();
    expect(await messagesFor(task.code)).toHaveLength(0);
    expect((await outboxRows())[0]).toMatchObject({ status: 'skipped', last_error: 'ALERTS_OFF' });
  });
});

describe('AC-7 (NFR-002, NFR-015): the message', () => {
  it('has the SCR-22 words, the task, the folder as a path and a link, the assigner, "Overdue by", and the full link, in both bodies, with the 23:30 IST deadline', async () => {
    const deadline = new Date('2026-11-06T18:00:00.000Z');
    clock.set(new Date(deadline.getTime() + 90 * MILLISECONDS_PER_MINUTE));
    const task = await seed({ deadline });
    await minute();
    const [mail] = await messagesFor(task.code);
    expect(mail).toBeDefined();
    expect(mail?.from).toEqual({ name: 'Accucut Portal', address: 'portal@example.com' });
    expect(mail?.to).toEqual([addressOf[engineerId]]);
    expect(mail?.cc).toEqual([addressOf[leadId]]);
    expect(mail?.inlineContentIds).toContain(LOGO_CONTENT_ID);
    for (const body of [mail?.html ?? '', mail?.text ?? '']) {
      for (const words of [
        'This task is now overdue. It was due on 06 Nov 2026, 23:30 IST.',
        task.code,
        'Hopper cover',
        'Invented lead',
        PATH,
        'file:////invented-server/invented-share/RFQ-123',
        'Overdue by: 1 h',
        'Open the task',
        `${ORIGIN}/estimates/${task.code}`,
      ]) {
        expect(body, words).toContain(words);
      }
    }
    expect(mail?.text).not.toMatch(/<[a-z]/i);
  });

  it('shows markup in a title as text in the HTML body', async () => {
    const hostile = '<script>alert(1)</script> & <b>x</b>';
    const task = await seed({ deadline: ago(MILLISECONDS_PER_MINUTE), title: hostile });
    await minute();
    const [mail] = await messagesFor(task.code);
    expect(mail?.html).not.toContain('<script>');
    expect(mail?.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &lt;b&gt;x&lt;/b&gt;');
    expect(mail?.text).toContain(hostile);
  });

  it('finds none of the forbidden canary strings of the masters, the rate names or the formula markers in any captured message or outbox row', async () => {
    const codes = [(await seed({ deadline: ago(MILLISECONDS_PER_MINUTE) })).code, (await seed({ deadline: ago(2 * MILLISECONDS_PER_MINUTE), title: null })).code];
    await minute();
    const forbidden = forbiddenStrings();
    expect(forbidden.length).toBeGreaterThan(0);
    const rowText = JSON.stringify(await outboxRows());
    for (const code of codes) {
      const [mail] = await messagesFor(code);
      expect(mail, code).toBeDefined();
      const everything = [mail?.subject, mail?.html, mail?.text, rowText].join('\n');
      for (const { text, reason } of forbidden) expect(everything, `${reason}: ${text}`).not.toContain(text);
    }
  });
});

describe('AC-8 (NFR-024): the record of a run', () => {
  it('a run that queued messages writes one job_runs row: status ok and the counts, and nothing about a task', async () => {
    await seed({ deadline: ago(MILLISECONDS_PER_MINUTE) });
    await seed({ deadline: ago(2 * MILLISECONDS_PER_MINUTE) });
    await scan();
    expect(await jobRuns()).toEqual([{ job: 'overdue-scan', result: { status: 'ok', found: 2, queued: 2 } }]);
  });

  it('a run that found nothing writes no row', async () => {
    await scan();
    await seed({ deadline: new Date(NOW.getTime() + MILLISECONDS_PER_HOUR) });
    await scan();
    expect(await jobRuns()).toEqual([]);
  });

  it('a run that fails (the database cannot be read) is logged at error by the class of its error and recorded as failed, and the next run still happens', async () => {
    const task = await seed({ deadline: ago(MILLISECONDS_PER_MINUTE) });
    const lines: Array<{ message: string; level: JobLogLevel | undefined; fields: JobLogFields | undefined }> = [];
    const log = (message: string, level?: JobLogLevel, fields?: JobLogFields): void => void lines.push({ message, level, fields });
    const broken: OverdueScanStore = { ...store, findCandidates: () => Promise.reject(new Error('connection to server at "10.0.0.1" failed: password authentication failed for user "planted-user"')) };

    await runJob({ name: 'overdue-scan', log, now: () => clock.now(), frequent: true, recordFailure: (run) => store.recordRun(run) }, () => performOverdueScan({ ...scanDependencies, store: broken }));
    expect(lines.filter((line) => line.level === 'error')).toEqual([{ message: expect.stringContaining('overdue-scan failed after'), level: 'error', fields: expect.objectContaining({ job: 'overdue-scan', errorName: 'Error' }) }]);
    expect(JSON.stringify(lines)).not.toMatch(/10\.0\.0\.1|planted-user|password/);
    expect(await jobRuns()).toEqual([{ job: 'overdue-scan', result: { status: 'failed', message: 'the run failed' } }]);
    expect(await outboxRows()).toHaveLength(0);

    clock.advance(MILLISECONDS_PER_MINUTE);
    await runJob({ name: 'overdue-scan', log, now: () => clock.now(), frequent: true, recordFailure: (run) => store.recordRun(run) }, () => performOverdueScan(scanDependencies));
    await send();
    expect(await messagesFor(task.code)).toHaveLength(1);
    expect((await jobRuns()).map((run) => run.result['status'])).toEqual(['failed', 'ok']);
  });
});

describe('AC-9 (NFR-010): the number of statements does not grow with the number of tasks', () => {
  /** A client that records every statement it sends, on its own pool. */
  function countingClient(statements: string[]): PrismaClient<'query'> {
    const client = new PrismaClient({ adapter: new PrismaPg(testPoolConfig('worker', db.database.runtimeUrl)), log: [{ emit: 'event', level: 'query' }] });
    client.$on('query', (event) => void statements.push(event.query));
    return client;
  }

  /** `count` tasks open and overdue, plus `futureCount` that are not due, in two statements. */
  async function seedMany(count: number, futureCount: number): Promise<void> {
    await db.owner.query(
      `INSERT INTO tasks (code, engineer_id, assigned_by, folder_path, deadline_at)
       SELECT 'Q-2026-' || ($4::bigint + n), $1::uuid, $2::uuid, $3, CASE WHEN n <= $5::int THEN $6::timestamptz - (n || ' minutes')::interval ELSE $6::timestamptz + (n || ' minutes')::interval END
       FROM generate_series(1, $5::int + $7::int) AS n`,
      [engineerId, leadId, PATH, reserveCodes(count + futureCount), count, NOW, futureCount],
    );
    await db.owner.query('INSERT INTO estimates (task_id) SELECT id FROM tasks WHERE id NOT IN (SELECT task_id FROM estimates)');
  }

  async function statementsOfOneScan(): Promise<{ readonly others: number; readonly inserts: number; readonly queued: number }> {
    const statements: string[] = [];
    const client = countingClient(statements);
    try {
      const outcome = await runOverdueScan({ store: createOverdueScanStore(client), clock, appOrigin: () => ORIGIN }, NOW);
      const inserts = statements.filter((statement) => /INSERT INTO "?email_outbox/i.test(statement)).length;
      return { others: statements.length - inserts, inserts, queued: outcome.status === 'ok' ? outcome.queued : -1 };
    } finally {
      await client.$disconnect();
    }
  }

  it('500 open tasks, 200 of them overdue: one scan queues 200 rows with the same number of other statements as a scan of 3, and its second scan reads once and writes nothing', async () => {
    await seedMany(3, 0);
    const small = await statementsOfOneScan();
    expect(small).toMatchObject({ inserts: 3, queued: 3 });
    await db.owner.query('DELETE FROM email_outbox');
    await db.owner.query('DELETE FROM estimates');
    await db.owner.query('DELETE FROM tasks');

    await seedMany(200, 300);
    const large = await statementsOfOneScan();
    expect(large).toMatchObject({ inserts: 200, queued: 200 });
    expect(large.others).toBe(small.others);
    expect(await outboxRows()).toHaveLength(200);

    const again = await statementsOfOneScan();
    expect(again).toMatchObject({ inserts: 0, queued: 0 });
    // Steady state: the switch and the candidates, and no transaction at all.
    expect(again.others).toBeLessThanOrEqual(small.others);
  });
});

describe('the store is the one place the rule is written in SQL', () => {
  it('returns the same set as isOverdue and the 24-hour window say, to the millisecond', async () => {
    const edges = [NOW.getTime() - 1, NOW.getTime(), NOW.getTime() + 1, NOW.getTime() - 24 * MILLISECONDS_PER_HOUR, NOW.getTime() - 24 * MILLISECONDS_PER_HOUR - 1];
    const tasks: Array<{ readonly id: string; readonly code: string }> = [];
    // One at a time: the test's owner connection runs one statement at once.
    for (const edge of edges) tasks.push(await seed({ deadline: new Date(edge) }));
    const found = await store.findCandidates(NOW, new Date(NOW.getTime() - 24 * MILLISECONDS_PER_HOUR));
    const codes = found.map((candidate) => candidate.code).sort();
    // Due 1 ms ago and due exactly 24 hours ago (the window is inclusive) are found; due now, later, or more than 24 hours ago are not.
    expect(codes).toEqual([defined(tasks[0]).code, defined(tasks[3]).code].sort());
    expect(found.every((candidate) => candidate.engineerId === engineerId && candidate.assigner.id === leadId && candidate.assigner.isActive)).toBe(true);
  });
});

