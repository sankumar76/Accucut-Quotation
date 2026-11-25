import type { Page } from '@playwright/test';

import { connectToTestDatabase } from './auth';
import { DEVELOPMENT_URL } from './servers';

/**
 * What the specs of Mark as quoted (CR-01 item 7C, AQP-400) share beyond the approved estimate of `approved-estimate.ts`: the stored marker and its audit entries read as the database's owner, the press made through the API as
 * another window would send it, and the Ignored layer set as Ignore sets it (three columns, the status untouched; story 7D, AQP-401). Every name is invented.
 */

const JSON_HEADERS = { origin: DEVELOPMENT_URL, 'content-type': 'application/json' };

export interface StoredQuote {
  readonly status: string;
  readonly quotedBy: string | null;
  readonly quotedAtSet: boolean;
  /** How many audit entries `estimate.quoted` the estimate has, and the first one's actor and statuses (`null` when there is none). */
  readonly entries: number;
  readonly entry: { readonly actorId: string; readonly before: unknown; readonly after: unknown } | null;
}

/** The estimate's status and quote marker, and its `estimate.quoted` entries, read from the throwaway database as its owner. */
export async function readQuote(estimateId: string): Promise<StoredQuote> {
  const client = await connectToTestDatabase();
  try {
    const { rows } = await client.query<{ status: string; quoted_by: string | null; quoted_at_set: boolean }>(
      'SELECT status::text AS status, quoted_by::text AS quoted_by, quoted_at IS NOT NULL AS quoted_at_set FROM estimates WHERE id = $1::uuid',
      [estimateId],
    );
    const row = rows[0];
    if (row === undefined) throw new Error('The estimate does not exist.');
    const entries = await client.query<{ actor_id: string; before: unknown; after: unknown }>(
      "SELECT actor_id::text AS actor_id, before, after FROM audit_log WHERE event = 'estimate.quoted' AND object_id = $1::uuid ORDER BY created_at, id",
      [estimateId],
    );
    const first = entries.rows[0];
    return {
      status: row.status,
      quotedBy: row.quoted_by,
      quotedAtSet: row.quoted_at_set,
      entries: entries.rows.length,
      entry: first === undefined ? null : { actorId: first.actor_id, before: first.before, after: first.after },
    };
  } finally {
    await client.end();
  }
}

/** The press of Mark as quoted through the API, as another window would send it; the status of the answer. */
export async function markQuotedThroughTheApi(page: Page, estimateId: string): Promise<number> {
  return (await page.request.post(`/api/v1/estimates/${estimateId}/quoted`, { headers: JSON_HEADERS })).status();
}

/** Sets the Ignored layer over the estimate, as Ignore does (story 7D, AQP-401): the three columns, the status untouched. */
export async function ignoreEstimate(estimateId: string, byUserId: string): Promise<void> {
  const client = await connectToTestDatabase();
  try {
    await client.query("UPDATE estimates SET ignored_at = now(), ignored_by = $2::uuid, ignore_remarks = 'Invented remarks.' WHERE id = $1::uuid", [estimateId, byUserId]);
  } finally {
    await client.end();
  }
}
