import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { canaryTaskCodeFor } from '../support/estimate-recipe';
import { defined } from '../support/defined';
import { FORBIDDEN_SIGNAL, harness, holdSessionClock, NOT_FOUND_SIGNAL, REDIRECT_PREFIX, releaseSessionClock } from '../support/session-harness';

/**
 * STORY-07.01 AC-3 and AC-6 (NFR-002) as a page: `/estimates/<code>/export` as each role, through the real page guard, the real session and the real export service over in-memory storage, drawn on the
 * server the way the first paint is. What a browser does with the button and the three widths is `tests/e2e/export.spec.ts`. Every name, ID and number is invented.
 */

vi.mock('next-auth', async () => ({ getServerSession: (await import('../support/session-harness')).harness.getServerSession }));
vi.mock('next/headers', async () => ({ headers: (await import('../support/session-harness')).harness.headers }));
vi.mock('next/navigation', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return { redirect: shared.redirect, forbidden: shared.forbidden, notFound: shared.notFound, useRouter: () => ({ refresh: () => undefined }) };
});
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T): T => fn }));
vi.mock('@/server/composition', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return {
    getAuthOptions: () => ({}),
    getUserRepository: () => shared.users,
    getEstimateService: () => shared.estimateService,
    getExportService: () => shared.exportService,
  };
});

const { default: ExportPage, metadata } = await import('@/app/(portal)/estimates/[code]/export/page');

const CODE = canaryTaskCodeFor(harness.targetId);
const estimate = () => defined(harness.estimateWorld.estimates[0]);
const open = async (code: string): Promise<string> => renderToStaticMarkup(await ExportPage({ params: Promise.resolve({ code }) }));

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);

beforeEach(() => {
  harness.signInAs('LEAD');
});

afterEach(() => {
  vi.restoreAllMocks();
  estimate().customerId = null;
});

describe('AC-6: a Lead and an Admin open the export page', () => {
  it.each(['LEAD', 'ADMIN'] as const)('as %s: the file card with its name, the rows and the columns A to BO, the Download button and the rows of the file', async (role) => {
    harness.signInAs(role);
    const html = await open(CODE);
    expect(html).toContain('Excel export');
    expect(html).toContain('The file');
    expect(html).toContain(`Quotation_Customer_${CODE}_2026-11-14.xlsx`);
    expect(html).toContain('1 part');
    expect(html).toContain('A to BO');
    expect(html).toContain('Download .xlsx');
    expect(html).toContain('The rows in the file');
    expect(html).toContain(`href="/estimates/${CODE}"`);
  });

  it('the tab title holds neither the task code nor a customer name', () => {
    expect(JSON.stringify(metadata)).toBe('{"title":"Excel export"}');
  });

  it('a code that is no task is the same SCR-26 "not found"', async () => {
    await expect(open('Q-1900-0001')).rejects.toThrow(NOT_FOUND_SIGNAL);
  });
});

describe('AC-3 (NFR-002): the Engineer and nobody signed in get nothing', () => {
  it('an Engineer is "no access" before anything is read, for a real address and an invented one, and no read is made', async () => {
    harness.signInAs('ENGINEER');
    const spies = [vi.spyOn(harness.exportReads, 'findHeader'), vi.spyOn(harness.exportReads, 'listNodes')];
    const workspace = vi.spyOn(harness.estimateService, 'getWorkspace');
    for (const code of [CODE, 'Q-1900-0001']) await expect(open(code)).rejects.toThrow(FORBIDDEN_SIGNAL);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    expect(workspace).not.toHaveBeenCalled();
  });

  it('nobody signed in is sent to sign in before anything is read', async () => {
    harness.signInAs(null);
    const workspace = vi.spyOn(harness.estimateService, 'getWorkspace');
    await expect(open(CODE)).rejects.toThrow(`${REDIRECT_PREFIX}/sign-in`);
    expect(workspace).not.toHaveBeenCalled();
  });
});
