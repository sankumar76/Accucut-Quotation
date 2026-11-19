import { expect, type Page, type TestInfo } from '@playwright/test';
import { z } from 'zod';

import { connectToTestDatabase, createDisposableUser, E2E_ADMIN, E2E_PASSWORD, type E2eUser } from './auth';
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

/**
 * The one Admin of the database (the E2E Admin of the set-up project), signed in, with the ID the audit rows will name. Cancel approval is the Admin's alone (STORY-06.12), and the portal allows one active Admin
 * (`uq_users_single_active_admin`), so an Admin cannot be made for a test: the specs of the other Admin actions sign in as this one, on an address of their own, in parallel. The entries it makes are
 * all of an estimate of the test's own, so no test reads another's; the audit screen's tests that filter on Who = E2E Admin pick an event no spec writes.
 */
export async function signInAsTheAdmin(page: Page): Promise<E2eUser & { readonly id: string }> {
  const client = await connectToTestDatabase();
  try {
    const { rows } = await client.query<{ id: string }>("SELECT id::text FROM users WHERE email = $1 AND role = 'ADMIN' AND is_active", [E2E_ADMIN.email]);
    const id = rows[0]?.id;
    if (id === undefined) throw new Error('The E2E Admin does not exist yet: the set-up project makes it.');
    const admin = { ...E2E_ADMIN, id };
    await signInAs(page, admin);
    return admin;
  } finally {
    await client.end();
  }
}

/** The latest approval of the estimate, which is what the page names when the Admin presses Cancel approval. */
export async function latestApprovalIdOf(estimateId: string): Promise<string> {
  const client = await connectToTestDatabase();
  try {
    const { rows } = await client.query<{ id: string }>('SELECT id::text FROM approvals WHERE estimate_id = $1::uuid AND removed_at IS NULL ORDER BY approved_at DESC, id DESC LIMIT 1', [estimateId]);
    const id = rows[0]?.id;
    if (id === undefined) throw new Error('The estimate has no approval.');
    return id;
  } finally {
    await client.end();
  }
}

/** The Admin's cancel through the API, as another window would send it (the password is the shared invented one). Returns the status of the answer. */
export async function cancelThroughTheApi(page: Page, estimateId: string, reason: string): Promise<number> {
  const approvalId = await latestApprovalIdOf(estimateId);
  return (await page.request.post(`/api/v1/estimates/${estimateId}/approval/cancel`, { headers: JSON_HEADERS, data: { approvalId, reason, password: E2E_PASSWORD } })).status();
}

export interface StoredCancel {
  /** The approval's price, which a cancel never changes. */
  readonly approvedPrice: string;
  readonly cancelledBy: string | null;
  readonly reason: string | null;
  /** Whether the approval had been unlocked (AC-10: an approval kept through an unlock). */
  readonly unlocked: boolean;
  /** How many audit entries `approval.cancelled` the estimate has. */
  readonly entries: number;
  /** Whether the password the test sent is in any audit row of the estimate (AC-7). Always false. */
  readonly passwordInAudit: boolean;
}

/** What the estimate's latest approval and its cancel entries hold, read from the throwaway database as its owner; `null` when it has no approval. */
export async function readCancel(estimateId: string): Promise<StoredCancel | null> {
  const client = await connectToTestDatabase();
  try {
    const { rows } = await client.query<{ approved_price: string; cancelled_by: string | null; cancel_reason: string | null; unlocked: boolean }>(
      'SELECT approved_price::text, cancelled_by::text, cancel_reason, unlocked_at IS NOT NULL AS unlocked FROM approvals WHERE estimate_id = $1::uuid ORDER BY approved_at DESC, id DESC LIMIT 1',
      [estimateId],
    );
    const row = rows[0];
    if (row === undefined) return null;
    const entries = await client.query<{ n: number }>("SELECT count(*)::int AS n FROM audit_log WHERE event = 'approval.cancelled' AND object_id = $1::uuid", [estimateId]);
    const named = await client.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM audit_log WHERE object_id = $1::uuid AND (coalesce(before::text, '') || coalesce(after::text, '')) LIKE '%' || $2 || '%'",
      [estimateId, E2E_PASSWORD],
    );
    return {
      approvedPrice: row.approved_price,
      cancelledBy: row.cancelled_by,
      reason: row.cancel_reason,
      unlocked: row.unlocked,
      entries: entries.rows[0]?.n ?? 0,
      passwordInAudit: (named.rows[0]?.n ?? 0) > 0,
    };
  } finally {
    await client.end();
  }
}

/** The Admin's removal of the price through the API, as another window would send it (the password is the shared invented one). Returns the status of the answer. */
export async function removePriceThroughTheApi(page: Page, estimateId: string): Promise<number> {
  const approvalId = await latestApprovalIdOf(estimateId);
  return (await page.request.post(`/api/v1/estimates/${estimateId}/approval/remove-price`, { headers: JSON_HEADERS, data: { approvalId, password: E2E_PASSWORD } })).status();
}

export interface StoredRemoval {
  /** The approval's price, which a removal never changes: the row keeps it. */
  readonly approvedPrice: string;
  readonly cancelled: boolean;
  readonly removedBy: string | null;
  /** How many audit entries `approval.price_removed` the estimate has, and the price the first one keeps (AC-3, AC-6). */
  readonly entries: number;
  readonly entryKeeps: string | null;
  /** Whether the password the test sent is in any audit row of the estimate (AC-7). Always false. */
  readonly passwordInAudit: boolean;
}

/** What the estimate's latest approval and its removal entries hold, read from the throwaway database as its owner; `null` when it has no approval. */
export async function readRemoval(estimateId: string): Promise<StoredRemoval | null> {
  const client = await connectToTestDatabase();
  try {
    const { rows } = await client.query<{ approved_price: string; cancelled: boolean; removed_by: string | null }>(
      'SELECT approved_price::text, cancelled_at IS NOT NULL AS cancelled, removed_by::text FROM approvals WHERE estimate_id = $1::uuid ORDER BY approved_at DESC, id DESC LIMIT 1',
      [estimateId],
    );
    const row = rows[0];
    if (row === undefined) return null;
    const entries = await client.query<{ kept: string | null }>("SELECT before->>'approvedPrice' AS kept FROM audit_log WHERE event = 'approval.price_removed' AND object_id = $1::uuid ORDER BY created_at, id", [estimateId]);
    const named = await client.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM audit_log WHERE object_id = $1::uuid AND (coalesce(before::text, '') || coalesce(after::text, '')) LIKE '%' || $2 || '%'",
      [estimateId, E2E_PASSWORD],
    );
    return {
      approvedPrice: row.approved_price,
      cancelled: row.cancelled,
      removedBy: row.removed_by,
      entries: entries.rows.length,
      entryKeeps: entries.rows[0]?.kept ?? null,
      passwordInAudit: (named.rows[0]?.n ?? 0) > 0,
    };
  } finally {
    await client.end();
  }
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
