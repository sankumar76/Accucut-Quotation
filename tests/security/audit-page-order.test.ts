import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { FORBIDDEN_SIGNAL, harness, holdSessionClock, REDIRECT_PREFIX, releaseSessionClock } from '../support/session-harness';

/**
 * STORY-01.07 AC-7 (CR-33, QLT-69): `/audit` checks the role **before** it reads anything. A page that read the log first and
 * checked afterwards would still answer a Lead with "no access", so every answer-based test would pass, while the read (and
 * its cost, and any leak through timing or logging) happened for a role that may not see it. This test watches the reads: for a
 * refused role and for a signed-out visitor neither the audit service nor the user list is called. Swapping the lines fails it.
 */

vi.mock('next-auth', async () => ({ getServerSession: (await import('../support/session-harness')).harness.getServerSession }));
vi.mock('next/headers', async () => ({ headers: (await import('../support/session-harness')).harness.headers }));
vi.mock('next/navigation', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return { redirect: shared.redirect, forbidden: shared.forbidden, notFound: shared.notFound };
});
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T): T => fn }));
vi.mock('@/server/composition', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return {
    getAuthOptions: () => ({}),
    getUserRepository: () => shared.users,
    getUserService: () => shared.userService,
    getAuditService: () => shared.auditService,
  };
});

const { default: AuditPage } = await import('@/app/(portal)/audit/page');

const listAudit = vi.spyOn(harness.auditService, 'list');
const listUsers = vi.spyOn(harness.userService, 'list');

async function outcomeOf(): Promise<string> {
  try {
    await AuditPage();
    return 'renders';
  } catch (error) {
    return error instanceof Error ? error.message : 'unknown';
  }
}

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);

beforeEach(() => {
  listAudit.mockClear();
  listUsers.mockClear();
});

describe('AC-7: the role is checked before the log is read', () => {
  it.each(['LEAD', 'ENGINEER'] as const)('a %s is refused and neither the audit log nor the people are read', async (role) => {
    harness.signInAs(role);
    expect(await outcomeOf()).toBe(FORBIDDEN_SIGNAL);
    expect(listAudit).not.toHaveBeenCalled();
    expect(listUsers).not.toHaveBeenCalled();
  });

  it('a signed-out visitor is sent to sign-in and nothing is read', async () => {
    harness.signInAs(null);
    expect(await outcomeOf()).toMatch(new RegExp(`^${REDIRECT_PREFIX}/sign-in`));
    expect(listAudit).not.toHaveBeenCalled();
    expect(listUsers).not.toHaveBeenCalled();
  });

  it('only the ID and the name of each person reach the screen, every user is there, deactivated ones too, sorted by name (architect, 11091)', async () => {
    harness.signInAs('ADMIN');
    const record = harness.users.records.find((candidate) => candidate.email === 'invented.engineer@example.test');
    if (record === undefined) throw new Error('no Engineer');
    record.isActive = false;
    try {
      const element: unknown = await AuditPage();
      const props = z.object({ props: z.object({ people: z.array(z.record(z.string(), z.unknown())) }) }).parse(element).props;
      expect(props.people.length).toBe(harness.users.records.length);
      for (const person of props.people) expect(Object.keys(person).sort()).toEqual(['id', 'name']);
      const names = props.people.map((person) => String(person['name']));
      expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
      expect(names).toContain('Invented Engineer');
      expect(JSON.stringify(props.people)).not.toMatch(/example\.test|role|isActive|passwordHash/);
    } finally {
      record.isActive = true;
    }
  });

  it('the Admin gets the page: the first page of the log is read once, with the default limit, and so are the people', async () => {
    harness.signInAs('ADMIN');
    expect(await outcomeOf()).toBe('renders');
    expect(listAudit).toHaveBeenCalledTimes(1);
    expect(listAudit).toHaveBeenCalledWith({ limit: 50 });
    expect(listUsers).toHaveBeenCalledTimes(1);
  });
});
