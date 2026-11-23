/**
 * The marker of an estimate's Excel downloads (STORY-CR01.7E, AQP-402; CR-01 item 7c; FR-111, FR-011; architecture section 4.12 d). Pure code over three facts, so every screen that shows it says the same thing and
 * the rule has one place:
 *
 *   - **none**: no download has been recorded ("Not downloaded").
 *   - **changed** ("Changed since download", amber): the estimate's **current approval is not the approval in the last downloaded file** (product-manager ruling, 2026-11-22). A file downloaded before any
 *     approval holds no price and counts as "no approval", so the first approval after such a download makes it changed. An approval that was cancelled or whose price was removed no longer stands, so a file
 *     that carried it is changed too. **Marking an estimate as quoted is no input**: only approvals are compared, so a quote alone never turns the marker amber.
 *   - **downloaded** ("Downloaded N times"): otherwise, with the last person and time.
 *
 * `latestApprovalId` and the approval stored with each download are the ID of the estimate's approval **that stands** at that moment, or `null` when none does (never approved, cancelled, or its price removed):
 * the file carries a price in BO2 exactly when there is one (`approvedPriceOf`). The result holds a count, a person's name and an instant and nothing else; it is Internal data for a Lead and an Admin only (NFR-002),
 * and no screen that an Engineer may open imports it.
 */

/** The last download of an estimate, as the marker reads it. */
export interface LastDownload {
  /** The approval whose price the file carried, or `null` when the file held no price. */
  readonly approvalId: string | null;
  /** The name now of the person who downloaded. */
  readonly byName: string;
  readonly at: Date;
}

export interface DownloadMarkerFacts {
  /** How many downloads are recorded. */
  readonly count: number;
  /** The newest one; `null` exactly when `count` is 0 (they come from one query). */
  readonly last: LastDownload | null;
  /** The approval that stands now, or `null` when none does. */
  readonly latestApprovalId: string | null;
}

/** Who downloaded last and when. */
export interface LastDownloadView {
  readonly byName: string;
  readonly at: Date;
}

export type DownloadMarker =
  | { readonly kind: 'none' }
  | { readonly kind: 'downloaded'; readonly count: number; readonly last: LastDownloadView }
  | { readonly kind: 'changed'; readonly count: number; readonly last: LastDownloadView };

export function downloadMarkerOf({ count, last, latestApprovalId }: DownloadMarkerFacts): DownloadMarker {
  if (count === 0) return { kind: 'none' };
  // The count and the last download are read together: a count with no last download is a fault in the data, never a guessed marker.
  if (last === null) throw new Error('A download count above 0 has a last download.');
  const view: LastDownloadView = { byName: last.byName, at: last.at };
  return last.approvalId === latestApprovalId ? { kind: 'downloaded', count, last: view } : { kind: 'changed', count, last: view };
}
