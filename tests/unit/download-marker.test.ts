import { describe, expect, it } from 'vitest';

import { downloadMarkerOf, type LastDownload } from '@/lib/export/download-marker';

/**
 * STORY-CR01.7E (AQP-402) AC-4 (CR-01 item 7c; product-manager ruling of 2026-11-22; architecture section 4.12 d): the marker of an estimate's downloads is pure code over three facts. "Changed since
 * download" means the estimate's current approval is not the approval in the last downloaded file, where a file downloaded before any approval counts as "no approval". Every ID and name is invented.
 */

const FIRST = 'approval-1';
const SECOND = 'approval-2';

const last = (approvalId: string | null): LastDownload => ({ approvalId, byName: 'Invented Lead', at: new Date('2026-11-23T04:30:00.000Z') });

describe('AC-4: downloadMarkerOf', () => {
  it('says none when there is no download, whatever the approval is', () => {
    expect(downloadMarkerOf({ count: 0, last: null, latestApprovalId: null })).toEqual({ kind: 'none' });
    expect(downloadMarkerOf({ count: 0, last: null, latestApprovalId: FIRST })).toEqual({ kind: 'none' });
  });

  it('says downloaded N times, with the last person and time, when the approval is the one in the last file', () => {
    expect(downloadMarkerOf({ count: 2, last: last(FIRST), latestApprovalId: FIRST })).toEqual({ kind: 'downloaded', count: 2, last: { byName: 'Invented Lead', at: new Date('2026-11-23T04:30:00.000Z') } });
  });

  it('says downloaded for a file with no approval while the estimate still has none', () => {
    expect(downloadMarkerOf({ count: 1, last: last(null), latestApprovalId: null })).toMatchObject({ kind: 'downloaded', count: 1 });
  });

  it('says changed when the estimate was approved again after the last download (a new approval, not the one in the file)', () => {
    expect(downloadMarkerOf({ count: 3, last: last(FIRST), latestApprovalId: SECOND })).toMatchObject({ kind: 'changed', count: 3 });
  });

  it('says changed for the first approval that came after a download of unapproved figures: a file with no approval counts as "no approval"', () => {
    expect(downloadMarkerOf({ count: 1, last: last(null), latestApprovalId: FIRST })).toMatchObject({ kind: 'changed', count: 1 });
  });

  it('says changed when the approval in the last file no longer stands (cancelled or its price removed) and none replaced it', () => {
    expect(downloadMarkerOf({ count: 1, last: last(FIRST), latestApprovalId: null })).toMatchObject({ kind: 'changed' });
  });

  it('keeps the last person and time on a changed marker, so the chip can still say who downloaded and when', () => {
    expect(downloadMarkerOf({ count: 4, last: last(FIRST), latestApprovalId: SECOND })).toEqual({ kind: 'changed', count: 4, last: { byName: 'Invented Lead', at: new Date('2026-11-23T04:30:00.000Z') } });
  });

  it('is the same for the same approval however many times it was downloaded (Mark as quoted is no input: only approvals are read)', () => {
    for (const count of [1, 2, 10, 200]) {
      expect(downloadMarkerOf({ count, last: last(FIRST), latestApprovalId: FIRST }).kind).toBe('downloaded');
    }
  });

  it('refuses a count above 0 with no last download: the two come from one query, so that is a fault in the data', () => {
    expect(() => downloadMarkerOf({ count: 1, last: null, latestApprovalId: null })).toThrow();
  });
});
