import { expect, type Page, type TestInfo } from '@playwright/test';

import { connectToTestDatabase, createDisposableUser, type E2eUser } from './auth';
import { approvedEstimate } from './approved-estimate';
import { calculateWithoutThePage, engineerWithEstimate, signInAs } from './calculated-estimate';
import { DEVELOPMENT_URL } from './servers';

/**
 * What the specs of Ignore and Restore (CR-01 item 7D, AQP-401) share: an estimate in each status the layer can lie over, reached **through the API** (the 30 s of a test are spent on its subject and not on the page
 * loads of the approval, AQP-340), the layer as the database holds it and the audit entries of the two events, the press of Ignore and Restore as another window would send it, and the deadline moved into the past.
 * Every name and path is invented.
 */

const JSON_HEADERS = { origin: DEVELOPMENT_URL, 'content-type': 'application/json' };

export type UnderlyingStatus = 'DRAFT' | 'PREPARED' | 'APPROVED';

export interface EstimateForIgnoring {
  readonly owner: E2eUser & { readonly id: string };
  /** The Lead who is signed in when this returns. */
  readonly lead: E2eUser & { readonly id: string };
  readonly code: string;
}

/** An Engineer with an estimate in this status, and a Lead of the test's own signed in. Draft is the canary estimate as it is; Prepared is calculated by the Engineer; Approved is approved by the Lead. */
export async function estimateInStatus(page: Page, testInfo: TestInfo, status: UnderlyingStatus): Promise<EstimateForIgnoring> {
  if (status === 'APPROVED') return approvedEstimate(page, testInfo);
  const { owner, code } = await engineerWithEstimate(testInfo);
  if (status === 'PREPARED') await calculateWithoutThePage(page, owner);
  const lead = await createDisposableUser('axe', testInfo, 'LEAD');
  await signInAs(page, lead);
  return { owner, lead, code };
}

export interface StoredLayer {
  readonly status: string;
  readonly ignoredAtSet: boolean;
  readonly ignoredBy: string | null;
  readonly remarks: string | null;
  readonly ignored: number;
  readonly restored: number;
  readonly ignoredEntry: { readonly actorId: string; readonly before: unknown; readonly after: unknown } | null;
  readonly restoredEntry: { readonly actorId: string; readonly before: unknown; readonly after: unknown } | null;
}

/** The estimate's status and Ignored layer, and its `estimate.ignored` and `estimate.restored` entries, read from the throwaway database as its owner. */
export async function readLayer(estimateId: string): Promise<StoredLayer> {
  const client = await connectToTestDatabase();
  try {
    const { rows } = await client.query<{ status: string; ignored_at_set: boolean; ignored_by: string | null; ignore_remarks: string | null }>(
      'SELECT status::text AS status, ignored_at IS NOT NULL AS ignored_at_set, ignored_by::text AS ignored_by, ignore_remarks FROM estimates WHERE id = $1::uuid',
      [estimateId],
    );
    const row = rows[0];
    if (row === undefined) throw new Error('The estimate does not exist.');
    const entries = async (event: string) =>
      (
        await client.query<{ actor_id: string; before: unknown; after: unknown }>(
          'SELECT actor_id::text AS actor_id, before, after FROM audit_log WHERE event = $2 AND object_id = $1::uuid ORDER BY created_at, id',
          [estimateId, event],
        )
      ).rows;
    const ignored = await entries('estimate.ignored');
    const restored = await entries('estimate.restored');
    const entry = (found: ReadonlyArray<{ actor_id: string; before: unknown; after: unknown }>) => {
      const first = found[0];
      return first === undefined ? null : { actorId: first.actor_id, before: first.before, after: first.after };
    };
    return {
      status: row.status,
      ignoredAtSet: row.ignored_at_set,
      ignoredBy: row.ignored_by,
      remarks: row.ignore_remarks,
      ignored: ignored.length,
      restored: restored.length,
      ignoredEntry: entry(ignored),
      restoredEntry: entry(restored),
    };
  } finally {
    await client.end();
  }
}

/** The press of Ignore through the API, as another window would send it; the status of the answer. */
export async function ignoreThroughTheApi(page: Page, estimateId: string, remarks: string): Promise<number> {
  return (await page.request.post(`/api/v1/estimates/${estimateId}/ignore`, { headers: JSON_HEADERS, data: { remarks } })).status();
}

/** The press of Restore through the API, as another window would send it; the status of the answer. */
export async function restoreThroughTheApi(page: Page, estimateId: string): Promise<number> {
  return (await page.request.post(`/api/v1/estimates/${estimateId}/restore`, { headers: JSON_HEADERS })).status();
}

/** Moves the task's deadline into the past (a day ago), so an open task is overdue: the Restore dialog then says so, and an ignored row must still show no overdue cue. */
export async function moveDeadlineIntoThePast(estimateId: string): Promise<void> {
  const client = await connectToTestDatabase();
  try {
    await client.query("UPDATE tasks SET deadline_at = now() - interval '1 day' WHERE id = (SELECT task_id FROM estimates WHERE id = $1::uuid)", [estimateId]);
  } finally {
    await client.end();
  }
}

/** Sets the Ignored layer directly, with these remarks, as Ignore does (the three columns, the status untouched): for the specs whose subject is what a person sees of an ignored task, not the Ignore. */
export async function setLayer(estimateId: string, byUserId: string, remarks: string): Promise<void> {
  const client = await connectToTestDatabase();
  try {
    await client.query('UPDATE estimates SET ignored_at = now(), ignored_by = $2::uuid, ignore_remarks = $3 WHERE id = $1::uuid', [estimateId, byUserId, remarks]);
  } finally {
    await client.end();
  }
}

/** The task's own title, so a queue search finds exactly one row (the code is the search's key). */
export const queueAddressOf = (tab: string, code: string): string => `/queue?tab=${tab}&assignedBy=anyone&q=${encodeURIComponent(code)}`;

/** The task code and the heading agree: the page is the one asked for and has finished its first paint. */
export async function expectHeading(page: Page, code: string): Promise<void> {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Estimate ${code}`);
}
