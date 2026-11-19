import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { FORBIDDEN_SIGNAL, harness, holdSessionClock, NOT_FOUND_SIGNAL, REDIRECT_PREFIX, releaseSessionClock } from '../../support/session-harness';

/**
 * STORY-04.07 AC-2, AC-6, AC-7: `/assign?task=<id>` as each role, through the real page guard, the real session and the real task service over in-memory storage, drawn on the
 * server the way the first paint is. What a browser does with the form (the keys, the focus, the messages) is the E2E spec's. Every name, path and date is invented.
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

const UNKNOWN_ID = '00000000-0000-4000-8000-00000000dead';
/** The canary task of the harness: the Engineer's, due 10:00 IST on 1 January 2099 (04:30 UTC). */
const owned = (): string => harness.targetId;

const open = async (searchParams: Record<string, string | string[] | undefined>): Promise<string> =>
  renderToStaticMarkup(await AssignPage({ searchParams: Promise.resolve(searchParams) }));

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);

beforeEach(() => {
  harness.signInAs('LEAD');
});

afterEach(() => {
  harness.taskWorld.setStatus(owned(), 'DRAFT');
});

describe('without a task: the form of assigning, unchanged', () => {
  it('shows "Assign task" with its folder, title and notes fields, and none of the edit mode', async () => {
    const html = await open({});
    expect(html).toContain('Assign task');
    expect(html).toContain('Network folder path');
    expect(html).not.toContain('Locked');
    expect(html).not.toContain('Save changes');
  });
});

describe('AC-2: the edit mode of a Lead and an Admin', () => {
  it.each(['LEAD', 'ADMIN'] as const)('%s: only the Engineer and the deadline are editable; folder, title and notes show "Locked"; the notice and the button are the edit mode\'s', async (role) => {
    harness.signInAs(role);
    const html = await open({ task: owned() });
    expect(html).toContain('Reassign or change deadline');
    expect(html).toContain('Changes are logged. The log records your name, the time, and the old and new values.');
    expect(html).toContain('Save changes');
    expect(html).not.toContain('>Assign task<');
    // The three locked fields, each with the word and its value as text, not as a control.
    expect(html.split('Locked').length - 1).toBe(3);
    expect(html).toContain('Invented task');
    expect(html).toContain('Invented notes.');
    expect(html).toContain('\\\\invented-server\\invented-share\\RFQ-canary');
    expect(html).not.toContain('name="folderPath"');
    expect(html).not.toContain('name="title"');
    expect(html).not.toContain('name="notes"');
    // The two live controls.
    expect(html).toContain('name="engineerId"');
    expect(html).toContain('name="deadlineDate"');
    expect(html).toContain('name="deadlineTime"');
  });

  it('fills the controls with what the task holds: its Engineer selected, the IST date and the IST time, with the IST add-on', async () => {
    const html = await open({ task: owned() });
    expect(html).toMatch(new RegExp(`<option value="${harness.idOf.ENGINEER}" selected="">`));
    expect(html).toMatch(/name="deadlineDate"[^>]*value="2099-01-01"|value="2099-01-01"[^>]*name="deadlineDate"/);
    expect(html).toMatch(/name="deadlineTime"[^>]*value="10:00"|value="10:00"[^>]*name="deadlineTime"/);
    expect(html).toContain('IST');
  });

  it('lists the active Engineers, and no Lead or Admin', async () => {
    const html = await open({ task: owned() });
    expect(html).toContain(`<option value="${harness.targetId}"`);
    expect(html).not.toContain(`<option value="${harness.idOf.LEAD}"`);
    expect(html).not.toContain(`<option value="${harness.idOf.ADMIN}"`);
  });

  it('names no cost, rate or price', async () => {
    expect(await open({ task: owned() })).not.toMatch(/\b(rates?|prices?|costs?|formulas?)\b|₹/i);
  });
});

describe('AC-6: an approved task shows why it cannot be changed, and no form', () => {
  it('says so and offers the way back to the queue', async () => {
    harness.taskWorld.setStatus(owned(), 'APPROVED');
    const html = await open({ task: owned() });
    expect(html).toContain('This task is approved, so its Engineer and deadline can no longer be changed.');
    expect(html).toContain('Back to the task queue');
    expect(html).not.toContain('<form');
    expect(html).not.toContain('Save changes');
  });
});

describe('AC-7: who may open it', () => {
  it('an Engineer gets SCR-26 "no access" before anything is read, for a real task, an unknown one and a malformed one alike', async () => {
    harness.signInAs('ENGINEER');
    for (const task of [owned(), UNKNOWN_ID, 'not-an-id']) await expect(open({ task })).rejects.toThrow(FORBIDDEN_SIGNAL);
    await expect(open({})).rejects.toThrow(FORBIDDEN_SIGNAL);
  });

  it('signed out is sent to sign in before anything is read', async () => {
    harness.signInAs(null);
    await expect(open({ task: owned() })).rejects.toThrow(`${REDIRECT_PREFIX}/sign-in`);
  });

  it.each([UNKNOWN_ID, 'not-an-id', ''])('a task that is %j is SCR-26 "not found"', async (task) => {
    await expect(open({ task })).rejects.toThrow(NOT_FOUND_SIGNAL);
  });

  it('more than one task in the address is not the address of a task: "not found"', async () => {
    await expect(open({ task: [owned(), owned()] })).rejects.toThrow(NOT_FOUND_SIGNAL);
  });

  it('a Lead who did not assign the task opens it, and so does the Admin (D-f)', async () => {
    const other = harness.taskWorld.seed({ code: 'Q-9999-8101', engineerId: harness.idOf.ENGINEER, assignedById: harness.idOf.ADMIN, deadlineAt: new Date('2099-03-01T04:30:00.000Z') });
    const html = await open({ task: other.id });
    expect(html).toContain('Q-9999-8101');
    harness.signInAs('ADMIN');
    expect(await open({ task: other.id })).toContain('Save changes');
  });
});
