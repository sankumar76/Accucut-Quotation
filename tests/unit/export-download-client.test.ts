import { afterEach, describe, expect, it, vi } from 'vitest';

import { downloadExport, fileNameFrom, saveInBrowser, type SaveFile } from '@/lib/export/download-client';

/**
 * The browser's side of the download (STORY-07.01 AC-2, AC-6): one request, the file offered under the server's name, and the failure states the button shows. `fetch` and the browser's save are
 * replaced, so nothing is sent and nothing is written. Every ID and name is invented.
 */

const ESTIMATE_ID = '00000000-0000-4000-8000-0000000e5701';
const FALLBACK = 'Quotation_Fallback_Q-2026-0701_2026-11-14.xlsx';
const REFERENCE = 'req-0a1b2c3d';

const fileResponse = (disposition: string | null, body: BodyInit = 'PK-bytes'): Response => {
  const headers = new Headers({ 'X-Request-Id': REFERENCE });
  if (disposition !== null) headers.set('Content-Disposition', disposition);
  return new Response(body, { status: 200, headers });
};
const problem = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/problem+json', 'X-Request-Id': REFERENCE } });

afterEach(() => vi.restoreAllMocks());

describe('fileNameFrom', () => {
  it('reads the name from an attachment header, only when it is made of what the export makes', () => {
    expect(fileNameFrom('attachment; filename="Quotation_Acme_Q-2026-0701_2026-11-14.xlsx"')).toBe('Quotation_Acme_Q-2026-0701_2026-11-14.xlsx');
    expect(fileNameFrom('attachment; filename="../evil.xlsx"')).toBeNull();
    expect(fileNameFrom('attachment; filename="a b.xlsx"')).toBeNull();
    expect(fileNameFrom('attachment; filename="report.exe"')).toBeNull();
    expect(fileNameFrom(null)).toBeNull();
  });
});

describe('downloadExport', () => {
  it('asks for the file of the estimate, with the session, and offers it under the name the server gave', async () => {
    const doFetch = vi.fn<typeof fetch>().mockResolvedValue(fileResponse('attachment; filename="Quotation_Acme_Q-2026-0701_2026-11-15.xlsx"'));
    const save = vi.fn<SaveFile>();
    expect(await downloadExport(ESTIMATE_ID, FALLBACK, doFetch, save)).toEqual({ status: 'ok' });
    expect(doFetch).toHaveBeenCalledTimes(1);
    expect(doFetch.mock.calls[0]?.[0]).toBe(`/api/v1/estimates/${ESTIMATE_ID}/export`);
    expect(doFetch.mock.calls[0]?.[1]).toMatchObject({ credentials: 'same-origin' });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]?.[1]).toBe('Quotation_Acme_Q-2026-0701_2026-11-15.xlsx');
    expect(await save.mock.calls[0]?.[0].text()).toBe('PK-bytes');
  });

  it('uses the name the page showed when the header holds none it can trust', async () => {
    const save = vi.fn<SaveFile>();
    await downloadExport(ESTIMATE_ID, FALLBACK, vi.fn<typeof fetch>().mockResolvedValue(fileResponse('attachment; filename="../x.xlsx"')), save);
    expect(save.mock.calls[0]?.[1]).toBe(FALLBACK);
  });

  it('reports the server\'s own title, with its reference, for a refusal, and saves nothing', async () => {
    const save = vi.fn<SaveFile>();
    const doFetch = vi.fn<typeof fetch>().mockResolvedValue(problem(409, { code: 'NOT_CALCULATED', title: 'There is no file yet.' }));
    expect(await downloadExport(ESTIMATE_ID, FALLBACK, doFetch, save)).toEqual({ status: 'refused', title: 'There is no file yet.', reference: REFERENCE });
    expect(save).not.toHaveBeenCalled();
  });

  it.each([
    ['a server fault', () => problem(500, { code: 'INTERNAL', title: 'Something went wrong.' }), REFERENCE],
    ['an answer that is not a problem', () => new Response('<html>', { status: 502, headers: { 'X-Request-Id': REFERENCE } }), REFERENCE],
    ['a body that holds no code', () => problem(400, { title: 'x' }), REFERENCE],
  ] as const)('is "failed", with the reference, for %s', async (_name, make, reference) => {
    const save = vi.fn<SaveFile>();
    expect(await downloadExport(ESTIMATE_ID, FALLBACK, vi.fn<typeof fetch>().mockResolvedValue(make()), save)).toEqual({ status: 'failed', reference });
    expect(save).not.toHaveBeenCalled();
  });

  it('is "failed", with no reference, when the network fails', async () => {
    expect(await downloadExport(ESTIMATE_ID, FALLBACK, vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline')), vi.fn())).toEqual({ status: 'failed', reference: null });
  });

  it('is "failed" when the browser cannot save the file', async () => {
    const save: SaveFile = () => {
      throw new Error('blocked');
    };
    expect(await downloadExport(ESTIMATE_ID, FALLBACK, vi.fn<typeof fetch>().mockResolvedValue(fileResponse(null)), save)).toEqual({ status: 'failed', reference: REFERENCE });
  });
});

describe('saveInBrowser', () => {
  it('presses a link to the blob once, named, removes it, and lets the address go after a while', () => {
    vi.useFakeTimers();
    const click = vi.fn();
    const link = { href: '', download: '', rel: '', click, remove: vi.fn() };
    const append = vi.fn();
    vi.stubGlobal('document', { createElement: () => link, body: { append } });
    const create = vi.fn(() => 'blob:invented');
    const revoke = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke });
    saveInBrowser(new Blob(['x']), 'Quotation_A_Q-1_2026-11-14.xlsx');
    expect(link).toMatchObject({ href: 'blob:invented', download: 'Quotation_A_Q-1_2026-11-14.xlsx', rel: 'noopener' });
    expect(append).toHaveBeenCalledWith(link);
    expect(click).toHaveBeenCalledTimes(1);
    expect(link.remove).toHaveBeenCalledTimes(1);
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10_000);
    expect(revoke).toHaveBeenCalledWith('blob:invented');
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});
