import { describe, expect, it, vi } from 'vitest';

import { createJobRunWriter } from '@/server/repositories/job-run-repository';
import type { PrismaClient } from '@/server/repositories/prisma-client';

/**
 * STORY-10.05: the worker's one write to `job_runs`. The SQL is a tagged template, so every value reaches the database as a parameter and nothing is concatenated
 * into the statement. A fake client records the call; the real INSERT (and the grants that allow it) is proved by tests/integration/database-roles.test.ts.
 */

function fakeClient(executeRaw: ReturnType<typeof vi.fn>): PrismaClient {
  return { $executeRaw: executeRaw } as unknown as PrismaClient;
}

describe('createJobRunWriter', () => {
  it('inserts one row with the job, both times and the result as JSON, every value as a parameter', async () => {
    const executeRaw = vi.fn().mockResolvedValue(1);
    const started = new Date('2026-11-16T03:30:00Z');
    const finished = new Date('2026-11-16T03:30:01Z');
    await createJobRunWriter(fakeClient(executeRaw)).recordRun({ job: 'backup-watch', startedAt: started, finishedAt: finished, result: { status: 'ok', freeBytes: 1, totalBytes: 2 } });
    expect(executeRaw).toHaveBeenCalledTimes(1);
    const [strings, ...values] = executeRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    expect(strings.join('?').replace(/\s+/g, ' ').trim()).toBe('INSERT INTO job_runs (job, started_at, finished_at, result) VALUES (?, ?, ?, ?::jsonb)');
    expect(values).toEqual(['backup-watch', started, finished, '{"status":"ok","freeBytes":1,"totalBytes":2}']);
  });

  it('lets a database error through, so the job can log that it could not write', async () => {
    const executeRaw = vi.fn().mockRejectedValue(new Error('permission denied for table job_runs'));
    await expect(
      createJobRunWriter(fakeClient(executeRaw)).recordRun({ job: 'backup-watch', startedAt: new Date(), finishedAt: new Date(), result: { status: 'failed' } }),
    ).rejects.toThrow('permission denied');
  });

  it('puts a quote in the result into the parameter, never into the statement', async () => {
    const executeRaw = vi.fn().mockResolvedValue(1);
    await createJobRunWriter(fakeClient(executeRaw)).recordRun({ job: 'backup-watch', startedAt: new Date(), finishedAt: new Date(), result: { status: 'failed', message: "it's '); DROP TABLE job_runs; --" } });
    const [strings] = executeRaw.mock.calls[0] as [TemplateStringsArray];
    expect(strings.join('?')).not.toMatch(/DROP|it's/);
  });
});
