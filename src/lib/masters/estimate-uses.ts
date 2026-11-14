import { isRecord, type Refusal } from '../api-client';

/**
 * The open estimates that a customer or a material is used by, as the 409 of its delete names them (STORY-02.07 AC-2, AC-3; architecture section 6, "409 with
 * the open estimates using it"). The browser's side only: it reads the refusal's `estimates` and `estimateTotal` members and decides nothing. An estimate is
 * named by its task code and status, and nothing else (no figure, no title).
 */

export type OpenEstimateStatus = 'DRAFT' | 'SUBMITTED';

export interface EstimateUseRow {
  readonly code: string;
  readonly status: OpenEstimateStatus;
}

/** The first estimates the refusal names, and how many there are in all (the server names ten and counts the rest). */
export interface EstimateUsesRow {
  readonly total: number;
  readonly estimates: ReadonlyArray<EstimateUseRow>;
}

function toEstimateUse(value: unknown): EstimateUseRow | null {
  if (!isRecord(value)) return null;
  const { code, status } = value;
  return typeof code === 'string' && (status === 'DRAFT' || status === 'SUBMITTED') ? { code, status } : null;
}

/**
 * The estimates a 409 "cannot be deleted yet" names, or `null` when the refusal does not carry them (an answer of the wrong shape is never trusted blindly).
 * The total is at least the number named, so "and N more" is never negative.
 */
export function estimateUsesOf(refusal: Refusal): EstimateUsesRow | null {
  const { estimates, estimateTotal } = refusal.body;
  if (!Array.isArray(estimates) || typeof estimateTotal !== 'number') return null;
  const named = estimates.map(toEstimateUse);
  if (!named.every((use): use is EstimateUseRow => use !== null)) return null;
  return { total: Math.max(estimateTotal, named.length), estimates: named };
}

/** How many estimates are not named ("and N more"). */
export function unnamedCount(uses: EstimateUsesRow): number {
  return uses.total - uses.estimates.length;
}

/** "Draft" and "Submitted": the status as the screen says it (the words of SCR-06's badge). */
export function statusWords(status: OpenEstimateStatus): string {
  return status === 'DRAFT' ? 'Draft' : 'Submitted';
}
