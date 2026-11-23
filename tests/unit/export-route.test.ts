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
import { seedFieldAt } from '../support/seed-config';
import { plantCalculation, clearPlantedCalculation } from '../support/plant-calculation';
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
const DOWNLOAD_DATE = '14-11-2026';

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
  clearPlantedCalculation();
});

describe('AC-2, AC-4: the file', () => {
  it.each(['LEAD', 'ADMIN'] as const)('as %s: 200, an attachment of the right MIME type and name, `no-store`, a request ID, and a workbook of columns A to BO and the row of the part', async (role) => {
    const stored = plantCalculation();
    harness.signInAs(role);
    const response = await getFile(estimate().id);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe(XLSX_MIME);
    expect(response.headers.get('Content-Disposition')).toBe(`attachment; filename="Customer_Invented-subject_${DOWNLOAD_DATE}.xlsx"; filename*=UTF-8''Customer_Invented-subject_${DOWNLOAD_DATE}.xlsx`);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('X-Request-Id')).toMatch(/^req-[0-9a-f]{8}$/);
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(response.headers.get('Content-Length')).toBe(String(bytes.byteLength));
    const sheet = defined((await loadWorkbook(bytes)).getWorksheet('Quotation'));
    expect(sheet.columnCount).toBe(67);
    expect(sheet.getCell('A1').value).toBe('Sl. No');
    // The row of the part below the header: its Sl. No as text and its unit price, the stored figure (AC-1).
    expect(sheet.getCell('A2').value).toBe('1');
    expect(sheet.getCell('BG2').value).toBe(Number(defined(stored.outputs[seedFieldAt('BG').id])));
    expect(readXlsxParts(bytes).has('xl/workbook.xml')).toBe(true);
  });

  it('names the file <short name>_<subject>_<date>: a short name and a subject with a space, a slash and non-ASCII letters reach the header encoded, and the summary and the header say the same name (AQP-391 AC-1, AC-5, AC-6, AC-8)', async () => {
    plantCalculation();
    const customer = defined(harness.masters.customers[0]);
    const originalShortName = customer.shortName;
    const originalSubject = estimate().subject;
    customer.shortName = 'M A/S';
    estimate().subject = 'Kühler Ø 40 – 工场/x';
    estimate().customerId = customer.id;
    try {
      const response = await getFile(estimate().id);
      const disposition = defined(response.headers.get('Content-Disposition'));
      const expected = `M-A-S_Kühler-Ø-40-–-工场-x_${DOWNLOAD_DATE}.xlsx`;
      expect(disposition).toBe(
        `attachment; filename="M-A-S_Khler--40---x_${DOWNLOAD_DATE}.xlsx"; filename*=UTF-8''M-A-S_K%C3%BChler-%C3%98-40-%E2%80%93-%E5%B7%A5%E5%9C%BA-x_${DOWNLOAD_DATE}.xlsx`,
      );
      expect(decodeURIComponent(/filename\*=UTF-8''(.+)$/.exec(disposition)?.[1] ?? '')).toBe(expected);
      expect(exportSummarySchema.parse(await (await getSummary(estimate().id)).json()).fileName).toBe(expected);
    } finally {
      customer.shortName = originalShortName;
      if (originalSubject === undefined) delete estimate().subject;
      else estimate().subject = originalSubject;
    }
  });

  it('falls back to "Customer" while no customer is chosen, and to the task code for a subject that is empty after clean-up', async () => {
    plantCalculation();
    const originalSubject = estimate().subject;
    estimate().subject = '\u200B';
    try {
      const disposition = defined((await getFile(estimate().id)).headers.get('Content-Disposition'));
      expect(disposition).toContain(`filename="Customer_${canaryTaskCodeFor(harness.targetId)}_${DOWNLOAD_DATE}.xlsx"`);
    } finally {
      if (originalSubject === undefined) delete estimate().subject;
      else estimate().subject = originalSubject;
    }
  });

  it('STORY-CR01.7E AC-2: the file is recorded in the same request that serves it, once, for the person who downloaded', async () => {
    plantCalculation();
    const insert = vi.spyOn(harness.exportDownloads, 'insertDownload');
    const response = await getFile(estimate().id);
    expect(response.status).toBe(200);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0]?.[0]).toMatchObject({ estimateId: estimate().id, approvalId: null });
  });

  it('STORY-CR01.7E AC-2 (DL-302 condition a): a log write that fails fails the download: 500 with the fixed words of every fault, no file and no attachment', async () => {
    plantCalculation();
    vi.spyOn(harness.exportDownloads, 'insertDownload').mockRejectedValueOnce(new Error('the log could not be written'));
    const response = await getFile(estimate().id);
    expect(response.status).toBe(500);
    expect(response.headers.get('Content-Disposition')).toBeNull();
    expect(response.headers.get('Content-Type')).toContain('application/problem+json');
    const body = await response.text();
    expect(body).not.toMatch(/^PK/);
    expect(body).not.toContain('the log could not be written');
    expect(record.parse(JSON.parse(body))).toMatchObject({ status: 500, title: 'Something went wrong on our side.' });
  });

  it('STORY-CR01.7E AC-3: a refused download (never calculated) writes no row', async () => {
    const insert = vi.spyOn(harness.exportDownloads, 'insertDownload');
    expect((await getFile(estimate().id)).status).toBe(409);
    expect(insert).not.toHaveBeenCalled();
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

  it('AC-1: an estimate that was never calculated is 409 NOT_CALCULATED with fixed words and no file (architecture section 4.6)', async () => {
    const response = await getFile(estimate().id);
    expect(response.status).toBe(409);
    expect(response.headers.get('Content-Disposition')).toBeNull();
    expect(record.parse(await response.json())).toMatchObject({ status: 409, code: 'NOT_CALCULATED', title: 'There is no file to download yet. This estimate has not been calculated. The download stays off until a calculation is current.' });
  });

  it('AC-2: an estimate whose inputs changed after Calculate is 409 EXPORT_OUT_OF_DATE with its own words and no file, and the stale figures are not read', async () => {
    plantCalculation();
    estimate().inputsRevision += 1;
    const read = vi.spyOn(harness.reviewReads, 'findExportFigures');
    const response = await getFile(estimate().id);
    expect(response.status).toBe(409);
    expect(response.headers.get('Content-Disposition')).toBeNull();
    expect(record.parse(await response.json())).toMatchObject({ status: 409, code: 'EXPORT_OUT_OF_DATE', title: 'The total is cleared because an input changed. There is no file to download until you press Recalculate.' });
    expect(read).not.toHaveBeenCalled();
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
  it.each(['LEAD', 'ADMIN'] as const)('as %s: the name, the counts, the first and last column and the rows, through the strict schema, with no figure while the estimate is not calculated', async (role) => {
    harness.signInAs(role);
    const response = await getSummary(estimate().id);
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const summary = exportSummarySchema.parse(await response.json());
    expect(summary).toEqual({
      fileName: `Customer_Invented-subject_${DOWNLOAD_DATE}.xlsx`,
      partCount: 1,
      pictureCount: 0,
      columns: { first: 'A', last: 'BO', count: 67 },
      rows: [{ slNo: '1', name: '', count: null }],
      // Never calculated: the state says so and no figure of any kind is in the answer (STORY-07.03 AC-8).
      state: 'none',
      figures: null,
      // Nor a warning (STORY-07.06 AC-4): it is carried only while the calculation is current.
      warning: null,
      // Nothing was downloaded: the marker of the log says so (STORY-CR01.7E).
      download: { kind: 'none' },
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

  it('nobody signed in is 401 and not a 409, so the state of an estimate is not told to a stranger (AC-1, AC-2)', async () => {
    harness.signInAs(null);
    const never = await getFile(estimate().id);
    expect(never.status).toBe(401);
    expect(JSON.stringify(await never.json())).not.toMatch(/NOT_CALCULATED|EXPORT_OUT_OF_DATE|no file to download/);
    plantCalculation();
    estimate().inputsRevision += 1;
    const stale = await getFile(estimate().id);
    expect(stale.status).toBe(401);
    expect(JSON.stringify(await stale.json())).not.toMatch(/NOT_CALCULATED|EXPORT_OUT_OF_DATE|no file to download/);
  });

  it('the service refuses an Engineer by itself, so a caller that skipped the route still reads nothing and builds nothing', async () => {
    const spies = [vi.spyOn(harness.exportReads, 'findHeader'), vi.spyOn(harness.exportReads, 'listNodes')];
    const engineer = { id: harness.idOf.ENGINEER, role: 'ENGINEER' } as const;
    await expect(harness.exportService.getFile(engineer, estimate().id)).rejects.toMatchObject({ httpStatus: 403, code: 'FORBIDDEN' });
    await expect(harness.exportService.getSummary(engineer, estimate().id)).rejects.toMatchObject({ httpStatus: 403, code: 'FORBIDDEN' });
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});
