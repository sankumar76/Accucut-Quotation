import { type TestInfo } from '@playwright/test';

import { connectToTestDatabase } from './auth';

/**
 * What the treatment spec of the part form (`estimate-treatments.spec.ts`, STORY-05.06) needs from the database: a treatment of the test's own (an invented name carrying the screen size, the repeat
 * and the retry, so the three screen sizes and the retries never meet on one row), its rename and its delete as the Admin's routes do them, and a part's stored inputs as the database holds them.
 * Inserts and updates go through the throwaway database that the servers use (guarded in `connectToTestDatabase`). This file has no tests and its name does not end in `.spec.ts`.
 */

/** A treatment name nobody else has. */
export function newTreatmentName(testInfo: TestInfo, tag: string): string {
  return `E2E-form-${tag}-${testInfo.project.name}-r${testInfo.repeatEachIndex}-t${testInfo.retry}-${Math.random().toString(16).slice(2, 8)}`;
}

/** Adds a treatment and answers its ID. */
export async function insertTreatment(name: string): Promise<string> {
  const client = await connectToTestDatabase();
  try {
    const { rows } = await client.query<{ id: string }>(`INSERT INTO treatments (name) VALUES ($1) RETURNING id::text AS id`, [name]);
    const id = rows[0]?.id;
    if (id === undefined) throw new Error('The treatment could not be added.');
    return id;
  } finally {
    await client.end();
  }
}

export async function renameTreatment(id: string, name: string): Promise<void> {
  const client = await connectToTestDatabase();
  try {
    await client.query(`UPDATE treatments SET name = $2 WHERE id = $1::uuid`, [id, name]);
  } finally {
    await client.end();
  }
}

/** A hard delete, as the Admin's route does it: no estimate refers to a treatment by key. */
export async function deleteTreatment(id: string): Promise<void> {
  const client = await connectToTestDatabase();
  try {
    await client.query(`DELETE FROM treatments WHERE id = $1::uuid AND NOT is_system`, [id]);
  } finally {
    await client.end();
  }
}

/** What the database holds in a part's `inputs`, by field ID. The estimate and its one part have the owner's ID (the recipe of the scan). */
export async function readPartInputs(ownerId: string): Promise<Record<string, unknown>> {
  const client = await connectToTestDatabase();
  try {
    const { rows } = await client.query<{ inputs: Record<string, unknown> }>(`SELECT inputs FROM estimate_nodes WHERE id = $1::uuid`, [ownerId]);
    const row = rows[0];
    if (row === undefined) throw new Error('The part does not exist.');
    return row.inputs;
  } finally {
    await client.end();
  }
}

/** Puts a treatment into a part as the form stores it, `{ id, text }`, with no save through the page (a draft that held a treatment which was deleted afterwards). */
export async function storeTreatmentInPart(ownerId: string, fieldId: string, choice: { readonly id: string; readonly text: string }): Promise<void> {
  const client = await connectToTestDatabase();
  try {
    await client.query(`UPDATE estimate_nodes SET inputs = inputs || jsonb_build_object($2::text, $3::jsonb) WHERE id = $1::uuid`, [ownerId, fieldId, JSON.stringify(choice)]);
  } finally {
    await client.end();
  }
}
