import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { MILLISECONDS_PER_DAY } from '@/lib/time';
import { performBackupWatch, type BackupWatchDependencies, type StatfsFigures } from '@/server/jobs/backup-watch';
import { runOutboxSend } from '@/server/jobs/outbox-send';
import { createBackupMissedQueue } from '@/server/repositories/email-outbox-repository';
import { createJobRunWriter } from '@/server/repositories/job-run-repository';

import { addressOf, adminId, capture, closeWorld, db, openWorld, outboxRows, resetWorld, sendDependencies, setActive, setAlerts } from '../../support/overdue-world';

/**
 * STORY-09.06 AC-10 against real PostgreSQL in a throwaway database, as the runtime role, with the real `backup-watch` job, the real queue to the Admin, the real `outbox-send` job and a capturing
 * mail server: a late backup, or a nearly full disk, queues ONE row to the active Admin (read from `users`, no Cc, the ID and never the address in the row), the message holds no figure, path,
 * drive letter or volume name, a second run on the same IST date adds nothing, a later day that is still late queues a new one, and with the alerts OFF (or no queue given: `FEATURE_EMAIL` off) or a
 * good backup and a roomy disk there is no row. Every value is invented.
 */

// Many messages go through SMTP to a shared capture server: a busy machine needs more than Vitest's 5 s.
vi.setConfig({ testTimeout: 30_000 });

beforeAll(() => openWorld(6));
afterAll(closeWorld);
beforeEach(resetWorld);

/** 09:00 IST on 20 November 2026. */
const NINE_IST = new Date('2026-11-20T03:30:00.000Z');
const DAY = MILLISECONDS_PER_DAY;
const LATE = new Date(NINE_IST.getTime() - 9 * DAY);
const GOOD = new Date(NINE_IST.getTime() - 2 * DAY);
/** Blocks of 10 bytes on a disk of 100 blocks: `free` blocks of them are free. */
const disk = (freeBlocks: number): StatfsFigures => ({ bsize: 10, blocks: 100, bavail: freeBlocks });
const INVENTED_VOLUME = 'Q:/';

function watchWith(latestGoodBackup: Date | null, figures: StatfsFigures, now: Date, withQueue = true): BackupWatchDependencies {
  const writer = createJobRunWriter(db.prisma);
  return {
    statfs: () => Promise.resolve(figures),
    store: { latestGoodBackupAt: () => Promise.resolve(latestGoodBackup), recordRun: (run) => writer.recordRun(run) },
    now: () => now,
    alert: withQueue ? createBackupMissedQueue(db.prisma) : undefined,
  };
}

const run = (dependencies: BackupWatchDependencies) => performBackupWatch({ backupVolume: INVENTED_VOLUME }, dependencies);
const backupRows = async () => (await outboxRows()).filter((row) => row.event === 'backup-missed');

describe('AC-10: one row to the active Admin', () => {
  it('AC-10: a late backup with alerts ON queues one row: key backup-missed:<istDate>, To the Admin by ID, no Cc, pending, no address in it', async () => {
    const outcome = await run(watchWith(LATE, disk(60), NINE_IST));
    expect(outcome.summary).toContain('; e-mail to the Admin queued');
    const rows = await backupRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ idempotency_key: 'backup-missed:2026-11-20', event: 'backup-missed', to_user_id: adminId, cc_user_ids: [], status: 'pending' });
    // The row names the Admin by ID. (The bodies are left out of this check: the layout's logo content ID holds an "@" of its own.)
    expect(JSON.stringify({ ...rows[0], body_html: '', body_text: '' })).not.toContain('@');
  });

  it('AC-10: the message that is sent goes to the Admin\'s address only, says the backup is late, and holds no figure, path, drive letter or volume name', async () => {
    await run(watchWith(LATE, disk(5), NINE_IST));
    const [queued] = await backupRows();
    expect(await runOutboxSend(sendDependencies)).toMatchObject({ claimed: 1, sent: 1 });
    const adminAddress = addressOf[adminId];
    const mails = (await capture.list()).filter((mail) => mail.to.includes(adminAddress ?? '') && mail.subject === queued?.subject);
    expect(mails).toHaveLength(1);
    const [mail] = mails;
    expect(mail?.to).toEqual([adminAddress]);
    expect(mail?.cc).toEqual([]);
    expect(mail?.text).toContain('The weekly backup is late. The server disk is nearly full.');
    for (const part of [mail?.text ?? '', mail?.html ?? '']) {
      expect(part).not.toContain(INVENTED_VOLUME);
      expect(part).not.toMatch(/[A-Za-z]:[\\/]/);
      expect(part).not.toMatch(/\d+ ?%|bytes|\bGB\b/i);
    }
  });

  it('AC-10: free space below the limit alone queues the message, with the backup good', async () => {
    await run(watchWith(GOOD, disk(10), NINE_IST));
    const rows = await backupRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.body_text).toContain('The server disk is nearly full.');
    expect(rows[0]?.body_text).not.toContain('backup is late');
  });

  it('AC-10: a second run on the same IST date adds nothing; a later day that is still late queues a new one', async () => {
    await run(watchWith(LATE, disk(60), NINE_IST));
    const second = await run(watchWith(LATE, disk(60), new Date(NINE_IST.getTime() + 60_000)));
    expect(second.summary).toContain('already queued today');
    expect(await backupRows()).toHaveLength(1);
    await run(watchWith(LATE, disk(60), new Date(NINE_IST.getTime() + DAY)));
    expect((await backupRows()).map((row) => row.idempotency_key)).toEqual(['backup-missed:2026-11-20', 'backup-missed:2026-11-21']);
  });

  it('AC-10: the date of the key is the date in India: a run at 20:00 UTC on the 20th is the 21st', async () => {
    await run(watchWith(LATE, disk(60), new Date('2026-11-20T20:00:00.000Z')));
    expect((await backupRows()).map((row) => row.idempotency_key)).toEqual(['backup-missed:2026-11-21']);
  });
});

describe('AC-10: when there is no row', () => {
  it('AC-10: alerts OFF: no row, the line says so, and the run still writes its own job_runs row', async () => {
    await setAlerts(false);
    const outcome = await run(watchWith(LATE, disk(60), NINE_IST));
    expect(outcome.summary).toContain('; no e-mail: alerts are OFF');
    expect(outcome.level).toBe('error');
    expect(await backupRows()).toEqual([]);
    const { rows } = await db.owner.query("SELECT 1 FROM job_runs WHERE job = 'backup-watch'");
    expect(rows).toHaveLength(1);
  });

  it('AC-10: FEATURE_EMAIL off (the worker gives no queue): no row, and the log line only, as before', async () => {
    const outcome = await run(watchWith(LATE, disk(60), NINE_IST, false));
    expect(outcome.summary).toBe('backup-watch: 60 % of the disk is free; NO GOOD BACKUP in the last 8 days');
    expect(await backupRows()).toEqual([]);
  });

  it('AC-10: a good backup and room on the disk: no row', async () => {
    const outcome = await run(watchWith(GOOD, disk(60), NINE_IST));
    expect(outcome.level).toBe('info');
    expect(await backupRows()).toEqual([]);
  });

  it('AC-10: no active Admin: no row (an inactive Admin is not written to), and the run does not fail', async () => {
    await setActive(adminId, false);
    const outcome = await run(watchWith(LATE, disk(60), NINE_IST));
    expect(outcome.summary).toContain('; no e-mail: there is no active Admin');
    expect(await backupRows()).toEqual([]);
  });

  it('AC-10: the Admin is judged active again at send time (NFR-028): a row queued, then the Admin deactivated, is skipped as NO_RECIPIENT and nothing is sent', async () => {
    await run(watchWith(LATE, disk(60), NINE_IST));
    await setActive(adminId, false);
    expect(await runOutboxSend(sendDependencies)).toMatchObject({ claimed: 1, sent: 0, skipped: 1 });
    expect(await backupRows()).toMatchObject([{ status: 'skipped', last_error: 'NO_RECIPIENT' }]);
  });
});
