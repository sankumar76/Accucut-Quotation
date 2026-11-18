import { expect, type Page, type TestInfo } from '@playwright/test';
import { z } from 'zod';

import { connectToTestDatabase, createDisposableUser, type E2eUser } from './auth';
import { engineerWithEstimate, signInAs } from './calculated-estimate';
import { DEVELOPMENT_URL } from './servers';

/**
 * An approved estimate for the specs of Unlock (STORY-06.08), made **through the API** and not through the pages: the Engineer's Calculate, then a Lead's read of the costs (for the calculation's ID) and
 * Approve and lock, each one request on the signed-in context (`page.request`) with the origin header the CSRF check wants. A spec whose subject is the unlock does not need the three page loads that
 * the screens of the approval cost the development server (AQP-340, DL-229 to DL-233: the 30 s of a test are spent on the subject). The same requests are what the buttons send, so the estimate is in the
 * state the screens would have left it in. Every name and path is invented.
 */

const JSON_HEADERS = { origin: DEVELOPMENT_URL, 'content-type': 'application/json' };
const costsShape = z.object({ calculationId: z.string().min(1) });

export interface ApprovedEstimate {
  readonly owner: E2eUser & { readonly id: string };
  /** The Lead who approved, and who is signed in when this returns. */
  readonly lead: E2eUser & { readonly id: string };
  readonly code: string;
  readonly price: string;
}

export const APPROVED_PRICE = '48271.37';

/** An Engineer with a calculable estimate, calculated by the Engineer and approved at `APPROVED_PRICE` by a Lead of the test's own, who is left signed in. */
export async function approvedEstimate(page: Page, testInfo: TestInfo): Promise<ApprovedEstimate> {
  const { owner, code } = await engineerWithEstimate(testInfo);
  await signInAs(page, owner);
  const calculated = await page.request.post(`/api/v1/estimates/${owner.id}/calculate`, { headers: JSON_HEADERS });
  expect(calculated.status(), 'the Engineer\'s Calculate').toBe(200);

  const lead = await createDisposableUser('axe', testInfo, 'LEAD');
  await signInAs(page, lead);
  const costs = await page.request.get(`/api/v1/estimates/${owner.id}/costs`);
  expect(costs.status(), 'the Lead\'s read of the costs').toBe(200);
  const { calculationId } = costsShape.parse(await costs.json());
  const approved = await page.request.post(`/api/v1/estimates/${owner.id}/approve`, { headers: JSON_HEADERS, data: { calculationId, price: APPROVED_PRICE } });
  expect(approved.status(), 'the approval').toBe(200);
  return { owner, lead, code, price: APPROVED_PRICE };
}

/** The Lead's unlock through the API, as another window would send it. */
export async function unlockThroughTheApi(page: Page, estimateId: string, reason: string): Promise<number> {
  return (await page.request.post(`/api/v1/estimates/${estimateId}/unlock`, { headers: JSON_HEADERS, data: { reason } })).status();
}

export interface StoredUnlock {
  /** The approval row: its price, and who unlocked it, why (`null` while it stands). */
  readonly approvedPrice: string;
  readonly unlockedBy: string | null;
  readonly reason: string | null;
  /** How many audit entries `approval.unlocked` the estimate has. */
  readonly entries: number;
}

/** What the estimate's one approval and its unlock entries hold, read from the throwaway database as its owner; `null` when it has no approval. */
export async function readUnlock(estimateId: string): Promise<StoredUnlock | null> {
  const client = await connectToTestDatabase();
  try {
    const { rows } = await client.query<{ approved_price: string; unlocked_by: string | null; unlock_reason: string | null }>(
      'SELECT approved_price::text, unlocked_by::text, unlock_reason FROM approvals WHERE estimate_id = $1::uuid ORDER BY approved_at, id',
      [estimateId],
    );
    const row = rows[0];
    if (row === undefined) return null;
    const entries = await client.query<{ n: number }>("SELECT count(*)::int AS n FROM audit_log WHERE event = 'approval.unlocked' AND object_id = $1::uuid", [estimateId]);
    return { approvedPrice: row.approved_price, unlockedBy: row.unlocked_by, reason: row.unlock_reason, entries: entries.rows[0]?.n ?? 0 };
  } finally {
    await client.end();
  }
}
