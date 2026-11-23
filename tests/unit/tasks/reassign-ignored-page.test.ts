import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { harness, holdSessionClock, releaseSessionClock } from '../../support/session-harness';

/**
 * CR-01 item 7D, AC-6 (AQP-401; FR-040, DL-304): `/assign?task=<id>` for a task whose estimate is ignored. The task is read-only until it is restored, so the edit form is not shown: the page says so and where to restore it,
 * for a Lead and an Admin, whatever the status underneath, and the same page of a task that is not ignored is the form as before. The 409 `ESTIMATE_IGNORED` of the route (a task ignored after the form was opened) is
 * `tests/unit/tasks/reassign-service.test.ts`, `ignored-tab.test.ts` and `tests/security/ignored-estimate-refusals.test.ts`. Every name, path and date is invented.
 */

vi.mock('next-auth', async () => ({ getServerSession: (await import('../../support/session-harness')).harness.getServerSession }));
vi.mock('next/headers', async () => ({ headers: (await import('../../support/session-harness')).harness.headers }));
vi.mock('next/navigation', async () => {
  const { harness: shared } = await import('../../support/session-harness');
  return { redirect: shared.redirect, forbidden: shared.forbidden, notFound: shared.notFound };
});
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T): T => fn }));
vi.mock('@/server/composition', async () => {
  const { harness: shared } = await import('../../support/session-harness');
  return { getAuthOptions: () => ({}), getUserRepository: () => shared.users, getTaskService: () => shared.taskService };
});

const { default: AssignPage } = await import('@/app/(portal)/assign/page');

/** The canary task of the harness: the Engineer's. */
const owned = (): string => harness.targetId;
const open = async (): Promise<string> => renderToStaticMarkup(await AssignPage({ searchParams: Promise.resolve({ task: owned() }) }));

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);

beforeEach(() => {
  harness.signInAs('LEAD');
});

afterEach(() => {
  harness.taskWorld.setIgnored(owned(), null);
  harness.taskWorld.setStatus(owned(), 'DRAFT');
});

describe('a task whose estimate is ignored has no edit form', () => {
  it.each([
    ['LEAD', 'DRAFT'],
    ['ADMIN', 'PREPARED'],
    ['LEAD', 'APPROVED'],
  ] as const)('%s, status underneath %s: the page says the task is ignored and to restore it first, with the way back to the queue, and no form', async (role, status) => {
    harness.signInAs(role);
    harness.taskWorld.setStatus(owned(), status);
    harness.taskWorld.setIgnored(owned(), { remarks: 'Invented remarks.' });
    const html = await open();
    expect(html).toContain('This task is ignored, so its Engineer and deadline cannot be changed.');
    expect(html).toContain('It is in the Ignored tab of the task queue. Open it and restore it first.');
    expect(html).toContain('Back to the task queue');
    // An approved task's own sentence is not said for an ignored one, and none of the form is drawn.
    expect(html).not.toContain('This task is approved');
    expect(html).not.toContain('Save changes');
    expect(html).not.toContain('Locked');
  });

  it('the same task, not ignored, is the edit form as before', async () => {
    const html = await open();
    expect(html).toContain('Reassign or change deadline');
    expect(html).toContain('Save changes');
    expect(html).not.toContain('This task is ignored');
  });
});
