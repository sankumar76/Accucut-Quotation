import { describe, expect, it } from 'vitest';

import { XLSX_MIME } from '@/server/export/export-model';

import { ScanRecorder } from '../e2e/support/canary-scan';

/**
 * Review SQR-03 of AQP-332: a workbook that reaches the scan's recorder **without** the interceptor cannot be inflated (the text the browser's fetch gives is not the zip's bytes), so it must be reported as
 * not scanned, and never recorded with an empty body that passes. Every current journey attaches the interceptor, which inflates the file; this holds the line for one that does not.
 */

const answer = (status: number, type: string) => ({ status, headers: { 'content-type': type }, text: 'PK-not-text' });

describe('ScanRecorder.recordFetched, a call the interceptor did not see', () => {
  it('reports a workbook as unreadable (not scanned), and records no body for it', () => {
    const recorder = new ScanRecorder();
    const recorded = recorder.recordFetched('GET export (API)', 'GET', 'http://localhost/api/v1/estimates/x/export', answer(200, XLSX_MIME));
    expect(recorder.unreadable).toEqual(['GET export (API): a workbook that was not intercepted, so it was not scanned.']);
    expect(recorded.body).toBeNull();
  });

  it('reports nothing for an answer that is text, and reads its body', () => {
    const recorder = new ScanRecorder();
    const recorded = recorder.recordFetched('GET costs (API)', 'GET', 'http://localhost/api/v1/estimates/x/costs', answer(403, 'application/problem+json'));
    expect(recorder.unreadable).toEqual([]);
    expect(recorded.body).toBe('PK-not-text');
  });

  it('reports nothing for a refusal that carries the workbook type but no file (a 403 has no attachment)', () => {
    const recorder = new ScanRecorder();
    recorder.recordFetched('GET export (API)', 'GET', 'http://localhost/x', answer(403, XLSX_MIME));
    expect(recorder.unreadable).toEqual([]);
  });
});
