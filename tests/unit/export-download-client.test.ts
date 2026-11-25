import { afterEach, describe, expect, it, vi } from 'vitest';

import { downloadExport, fileNameFrom, saveInBrowser, type SaveFile } from '@/lib/export/download-client';

/**
 * The browser's side of the download (STORY-07.01 AC-2, AC-6): one request, the file offered under the server's name, and the failure states the button shows. `fetch` and the browser's save are
 * replaced, so nothing is sent and nothing is written. Every ID and name is invented.
 */

const ESTIMATE_ID = '00000000-0000-4000-8000-0000000e5701';
const FALLBACK = 'Customer_Q-2026-0701_14-11-2026.xlsx';
const REFERENCE = 'req-0a1b2c3d';

const fileResponse = (disposition: string | null, body: BodyInit = 'PK-bytes'): Response => {
  const headers = new Headers({ 'X-Request-Id': REFERENCE });
  if (disposition !== null) headers.set('Content-Disposition', disposition);
  return new Response(body, { status: 200, headers });
};
const problem = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/problem+json', 'X-Request-Id': REFERENCE } });

afterEach(() => vi.restoreAllMocks());

describe('fileNameFrom (AQP-391 AC-6)', () => {
  const encoded = (name: string): string => `attachment; filename="ASCII_x_14-11-2026.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}`;

  it('reads the name from the plain parameter, only when it is a name the export makes', () => {
    expect(fileNameFrom('attachment; filename="MAS_Feed-hopper_21-11-2026.xlsx"')).toBe('MAS_Feed-hopper_21-11-2026.xlsx');
    expect(fileNameFrom('attachment; filename="MAS_a.b-c_21-11-2026.xlsx"')).toBe('MAS_a.b-c_21-11-2026.xlsx');
    expect(fileNameFrom('attachment; filename="../evil.xlsx"')).toBeNull();
    expect(fileNameFrom('attachment; filename="a b.xlsx"')).toBeNull();
    expect(fileNameFrom('attachment; filename="report.exe"')).toBeNull();
    expect(fileNameFrom(null)).toBeNull();
    expect(fileNameFrom('inline')).toBeNull();
  });

  it('reads filename* first and decodes it, so a non-ASCII name is saved as it is', () => {
    expect(fileNameFrom(encoded('MAS_Kühler-Ø-40-工场_21-11-2026.xlsx'))).toBe('MAS_Kühler-Ø-40-工场_21-11-2026.xlsx');
    expect(fileNameFrom(encoded('M_🔧_21-11-2026.xlsx'))).toBe('M_🔧_21-11-2026.xlsx');
  });

  it('matches the parameter name in any case and with the charset in any case', () => {
    expect(fileNameFrom("attachment; FILENAME*=utf-8''MAS_x_21-11-2026.xlsx")).toBe('MAS_x_21-11-2026.xlsx');
  });

  it('falls back to the plain parameter when filename* is malformed, is another charset, or does not decode', () => {
    const plain = 'filename="MAS_x_21-11-2026.xlsx"';
    expect(fileNameFrom(`attachment; ${plain}; filename*=UTF-8''%E0%A4%A.xlsx`)).toBe('MAS_x_21-11-2026.xlsx');
    expect(fileNameFrom(`attachment; ${plain}; filename*=ISO-8859-1''MAS_y_21-11-2026.xlsx`)).toBe('MAS_x_21-11-2026.xlsx');
    expect(fileNameFrom(`attachment; ${plain}; filename*=UTF-8''`)).toBe('MAS_x_21-11-2026.xlsx');
  });

  it('falls back to the plain parameter when the decoded name is not one the export makes', () => {
    const plain = 'filename="MAS_x_21-11-2026.xlsx"';
    for (const bad of ['..%2Fevil.xlsx', 'a%22b.xlsx', 'a%0D%0Ab.xlsx', 'a%00b.xlsx', 'a%E2%80%AEb.xlsx', 'a%20b.xlsx', 'a.exe', '.hidden.xlsx', 'a%E3%85%A4b.xlsx']) {
      expect(fileNameFrom(`attachment; ${plain}; filename*=UTF-8''${bad}`), bad).toBe('MAS_x_21-11-2026.xlsx');
    }
  });

  it('is null when neither parameter is a name the export makes', () => {
    expect(fileNameFrom("attachment; filename=\"../x.xlsx\"; filename*=UTF-8''..%2Fx.xlsx")).toBeNull();
  });

  it('does not take the plain parameter out of a value of filename*', () => {
    expect(fileNameFrom("attachment; filename*=UTF-8''a%22%3B%20filename%3D%22b.xlsx")).toBeNull();
  });
});

describe('downloadExport', () => {
  it('asks for the file of the estimate, with the session, and offers it under the name the server gave', async () => {
    const doFetch = vi.fn<typeof fetch>().mockResolvedValue(fileResponse('attachment; filename="MAS_Feed_15-11-2026.xlsx"'));
    const save = vi.fn<SaveFile>();
    expect(await downloadExport(ESTIMATE_ID, FALLBACK, doFetch, save)).toEqual({ status: 'ok' });
    expect(doFetch).toHaveBeenCalledTimes(1);
    expect(doFetch.mock.calls[0]?.[0]).toBe(`/api/v1/estimates/${ESTIMATE_ID}/export`);
    expect(doFetch.mock.calls[0]?.[1]).toMatchObject({ credentials: 'same-origin' });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]?.[1]).toBe('MAS_Feed_15-11-2026.xlsx');
    expect(await save.mock.calls[0]?.[0].text()).toBe('PK-bytes');
  });

  it('saves the decoded filename* of the header (the name on the card), not the ASCII fallback', async () => {
    const save = vi.fn<SaveFile>();
    const header = "attachment; filename=\"MAS_Khler_15-11-2026.xlsx\"; filename*=UTF-8''MAS_K%C3%BChler_15-11-2026.xlsx";
    await downloadExport(ESTIMATE_ID, FALLBACK, vi.fn<typeof fetch>().mockResolvedValue(fileResponse(header)), save);
    expect(save.mock.calls[0]?.[1]).toBe('MAS_Kühler_15-11-2026.xlsx');
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

  // QLT-F-04 (#686; FR-070, architecture 4.6): a full build place is a limit of the moment, not a fault, so its own words are shown and nobody is sent to the administrator.
  const BUSY_TITLE = 'Other files are being built right now. Try again in a moment.';
  it('shows the own title of the server, with its reference, for 503 EXPORT_BUSY (a temporary limit, not a fault), and saves nothing', async () => {
    const save = vi.fn<SaveFile>();
    const doFetch = vi.fn<typeof fetch>().mockResolvedValue(problem(503, { code: 'EXPORT_BUSY', title: BUSY_TITLE }));
    expect(await downloadExport(ESTIMATE_ID, FALLBACK, doFetch, save)).toEqual({ status: 'refused', title: BUSY_TITLE, reference: REFERENCE });
    expect(save).not.toHaveBeenCalled();
  });

  it('keeps every other 5xx a fault: a 503 with another code, and a 503 with no code, give no title', async () => {
    const save = vi.fn<SaveFile>();
    for (const body of [{ code: 'SERVICE_UNAVAILABLE', title: 'Not ready.' }, { title: BUSY_TITLE }]) {
      expect(await downloadExport(ESTIMATE_ID, FALLBACK, vi.fn<typeof fetch>().mockResolvedValue(problem(503, body)), save), JSON.stringify(body)).toEqual({ status: 'failed', reference: REFERENCE });
    }
    // The code alone decides, not the status: EXPORT_BUSY on a 500 is not the busy answer.
    expect(await downloadExport(ESTIMATE_ID, FALLBACK, vi.fn<typeof fetch>().mockResolvedValue(problem(500, { code: 'EXPORT_BUSY', title: BUSY_TITLE })), save)).toEqual({ status: 'failed', reference: REFERENCE });
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
    saveInBrowser(new Blob(['x']), 'MAS_A_14-11-2026.xlsx');
    expect(link).toMatchObject({ href: 'blob:invented', download: 'MAS_A_14-11-2026.xlsx', rel: 'noopener' });
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
