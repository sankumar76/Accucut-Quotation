import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { ExportBusyError } from '@/lib/errors';
import { XLSX_MIME } from '@/server/export/export-model';
import { ExportThreadError } from '@/server/export/thread-runner';
import { exportSummarySchema } from '@/server/views/schemas/export';

import { forbiddenStrings } from '../support/canary-masters';
import { canaryTaskCodeFor } from '../support/estimate-recipe';
import { defined } from '../support/defined';
import { fixedForbiddenProblem, scanResponse } from '../support/scanner';
import { harness, holdSessionClock, releaseSessionClock } from '../support/session-harness';
import { loadWorkbook, readXlsxParts } from '../support/xlsx-parts';

/**
 * STORY-07.01 AC-2, AC-3, AC-4 and AC-6 (NFR-002; architecture section 6 "Export" and "Export summary"), through the real `withRoute`, the real session and the real export service over in-memory
 * storage, with the file built in process: `GET /estimates/{id}/export` answers a Lead and an Admin with an `.xlsx` attachment of the right name, headers and layout; `GET /estimates/{id}/export-summary`
 * answers what SCR-10 shows. An Engineer gets the fixed 403 and **no file** before the ID is looked at, and nobody signed in gets 401. Who may call on every route is `tests/security/role-matrix.test.ts`.
 * Every name, ID and number is invented.
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
    getEstimateService: () => shared.estimateService,
    getExportService: () => shared.exportService,
  };
});

const fileRoute = await import('@/app/api/v1/estimates/[id]/export/route');
const summaryRoute = await import('@/app/api/v1/estimates/[id]/export-summary/route');
const ORIGIN = 'https://portal.example.test';
const UNKNOWN_ID = '00000000-0000-4000-8000-00000000dead';
/** The harness fixes the clock of the service at 12:00 UTC on 14 November 2026: 17:30 IST the same day. */
const DOWNLOAD_DATE = '2026-11-14';

const estimate = () => defined(harness.estimateWorld.estimates[0]);
const request = (): Request => new Request(`${ORIGIN}/api/v1/estimates/x/export`);
const getFile = (id: string) => fileRoute.GET(request(), { params: Promise.resolve({ id }) });
const getSummary = (id: string) => summaryRoute.GET(request(), { params: Promise.resolve({ id }) });
const record = z.record(z.string(), z.unknown());

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  harness.signInAs('LEAD');
});

afterEach(() => {
  vi.restoreAllMocks();
  estimate().customerId = null;
});

describe('AC-2, AC-4: the file', () => {
  it.each(['LEAD', 'ADMIN'] as const)('as %s: 200, an attachment of the right MIME type and name, `no-store`, a request ID, and a workbook of columns A to BO', async (role) => {
    harness.signInAs(role);
    const response = await getFile(estimate().id);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe(XLSX_MIME);
    expect(response.headers.get('Content-Disposition')).toBe(`attachment; filename="Quotation_Customer_${canaryTaskCodeFor(harness.targetId)}_${DOWNLOAD_DATE}.xlsx"`);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('X-Request-Id')).toMatch(/^req-[0-9a-f]{8}$/);
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(response.headers.get('Content-Length')).toBe(String(bytes.byteLength));
    const sheet = defined((await loadWorkbook(bytes)).getWorksheet('Quotation'));
    expect(sheet.columnCount).toBe(67);
    expect(sheet.getCell('A1').value).toBe('Sl. No');
    expect(readXlsxParts(bytes).has('xl/workbook.xml')).toBe(true);
  });

  it('names the file after the customer: spaces become underscores and every other character outside A-Z a-z 0-9 _ - is removed', async () => {
    const customer = defined(harness.masters.customers[0]);
    const original = customer.name;
    customer.name = 'Acme Tools & Dies, "Ltd"\r\n';
    estimate().customerId = customer.id;
    try {
      const disposition = defined((await getFile(estimate().id)).headers.get('Content-Disposition'));
      expect(disposition).toBe(`attachment; filename="Quotation_Acme_Tools__Dies_Ltd_${canaryTaskCodeFor(harness.targetId)}_${DOWNLOAD_DATE}.xlsx"`);
    } finally {
      customer.name = original;
    }
  });

  it('is a read: each route exports GET and no other method', () => {
    for (const route of [fileRoute, summaryRoute]) expect(Object.keys(route).filter((name) => /^(GET|HEAD|POST|PUT|PATCH|DELETE)$/.test(name))).toEqual(['GET']);
  });

  it('a build refused because too many are running is 503 EXPORT_BUSY with fixed words and Retry-After, and no file (QS-01)', async () => {
    vi.spyOn(harness.exportService, 'getFile').mockRejectedValueOnce(new ExportBusyError());
    const response = await getFile(estimate().id);
    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBe('10');
    expect(response.headers.get('Content-Disposition')).toBeNull();
    expect(record.parse(await response.json())).toMatchObject({ status: 503, code: 'EXPORT_BUSY', title: 'Other files are being built right now. Try again in a moment.' });
  });

  it('a thread that failed is a 500 with the fixed words of every fault: its code tells the log which kind, and no message or setting is in the body (QS-04)', async () => {
    vi.spyOn(harness.exportService, 'getFile').mockRejectedValueOnce(new ExportThreadError('timeout'));
    const response = await getFile(estimate().id);
    expect(response.status).toBe(500);
    const { requestId, ...fixed } = record.parse(await response.json());
    expect(requestId).toMatch(/^req-[0-9a-f]{8}$/);
    expect(fixed).toEqual({ type: 'about:blank', title: 'Something went wrong on our side.', status: 500, code: 'EXPORT_THREAD_TIMEOUT' });
  });

  it('an estimate that does not exist and an ID that is no UUID are the same 404, with no file', async () => {
    const answers = await Promise.all(
      [UNKNOWN_ID, 'not-an-id'].map(async (id) => {
        const response = await getFile(id);
        const { requestId, ...fixed } = record.parse(await response.json());
        expect(requestId).toMatch(/^req-[0-9a-f]{8}$/);
        return { status: response.status, fixed };
      }),
    );
    for (const answer of answers) expect(answer.status).toBe(404);
    expect(new Set(answers.map((answer) => JSON.stringify(answer.fixed))).size).toBe(1);
  });
});

describe('AC-6: the summary', () => {
  it.each(['LEAD', 'ADMIN'] as const)('as %s: the name, the counts, the first and last column and the rows, through the strict schema, with no figure', async (role) => {
    harness.signInAs(role);
    const response = await getSummary(estimate().id);
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const summary = exportSummarySchema.parse(await response.json());
    expect(summary).toEqual({
      fileName: `Quotation_Customer_${canaryTaskCodeFor(harness.targetId)}_${DOWNLOAD_DATE}.xlsx`,
      partCount: 1,
      pictureCount: 0,
      columns: { first: 'A', last: 'BO', count: 67 },
      rows: [{ slNo: '1', name: '', count: null }],
    });
  });

  it('an estimate that does not exist is a 404', async () => {
    expect((await getSummary(UNKNOWN_ID)).status).toBe(404);
  });
});

describe('AC-3 (NFR-002): an Engineer and a signed-out caller get nothing', () => {
  const FORBIDDEN = forbiddenStrings();

  it.each([
    ['the file', getFile],
    ['the summary', getSummary],
  ] as const)('an Engineer is refused %s: 403 with the fixed body and no file, before the ID is looked at', async (label, call) => {
    harness.signInAs('ENGINEER');
    const spies = [vi.spyOn(harness.exportReads, 'findHeader'), vi.spyOn(harness.exportReads, 'listNodes')];
    for (const id of [estimate().id, UNKNOWN_ID, 'not-an-id']) {
      const response = await call(id);
      const recorded = { label: `GET ${label}`, url: ORIGIN, status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() };
      expect(fixedForbiddenProblem(recorded)).toBeNull();
      expect(scanResponse(recorded, FORBIDDEN)).toEqual([]);
      expect(response.headers.get('Content-Type')).not.toBe(XLSX_MIME);
      expect(response.headers.get('Content-Disposition')).toBeNull();
      expect(recorded.body.startsWith('PK')).toBe(false);
    }
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it.each([
    ['the file', getFile],
    ['the summary', getSummary],
  ] as const)('nobody signed in is 401 for %s, and nothing is read', async (_label, call) => {
    harness.signInAs(null);
    const spy = vi.spyOn(harness.exportReads, 'findHeader');
    expect((await call(estimate().id)).status).toBe(401);
    expect(spy).not.toHaveBeenCalled();
  });

  it('the service refuses an Engineer by itself, so a caller that skipped the route still reads nothing and builds nothing', async () => {
    const spies = [vi.spyOn(harness.exportReads, 'findHeader'), vi.spyOn(harness.exportReads, 'listNodes')];
    const engineer = { id: harness.idOf.ENGINEER, role: 'ENGINEER' } as const;
    await expect(harness.exportService.getFile(engineer, estimate().id)).rejects.toMatchObject({ httpStatus: 403, code: 'FORBIDDEN' });
    await expect(harness.exportService.getSummary(engineer, estimate().id)).rejects.toMatchObject({ httpStatus: 403, code: 'FORBIDDEN' });
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});
