import { randomBytes, randomInt } from 'node:crypto';

import { expect, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import { Client } from 'pg';
import { z } from 'zod';

import { assertThrowawayDatabase } from '../../../scripts/lib/measurement-user';
import type { ConfigDocument } from '../../../src/lib/fields/schema';
import { PROCESS_CANARY_RATES } from '../../support/canary-masters';
import { canaryPartInputs } from '../../support/canary-part-inputs';
import { loadCanaryCustomers } from '../../support/customer-canary-loader';
import { EXCHANGE_RATE_CANARIES } from '../../support/exchange-rate-canary';
import { CANARY_FOLDER_PATH, canaryTaskCodeFor } from '../../support/estimate-recipe';
import { displayFormOf } from '../../support/formula-display';
import { loadCanaryMaterials } from '../../support/material-canary-loader';
import { assertSafeDatabaseTarget } from '../../support/db-guard';
import { createTestHasher } from '../../support/builders/user';
import { HARNESS_PASSWORD } from '../../support/harness-password';

import { waitUntilHydrated } from './design-system';

/**
 * Shared by the sign-in journey (`sign-in.spec.ts`), the set-up project (`auth.setup.ts`) and the playwright
 * configuration. This file has no tests and its name does not end in `.spec.ts`.
 */

/** Invented people for the journey. `.test` is a reserved domain; the password exists only here. */
export const E2E_PASSWORD = HARNESS_PASSWORD;

export interface E2eUser {
  readonly name: string;
  readonly email: string;
  readonly role: 'ADMIN' | 'LEAD' | 'ENGINEER';
}

export const E2E_LEAD: E2eUser = { name: 'E2E Lead', email: 'e2e.lead@example.test', role: 'LEAD' };
export const E2E_ENGINEER: E2eUser = { name: 'E2E Engineer', email: 'e2e.engineer@example.test', role: 'ENGINEER' };
/** The one active Admin the Users spec signs in as (STORY-01.04); `ensureE2eAdmin` makes sure it is the one. */
export const E2E_ADMIN: E2eUser = { name: 'E2E Admin', email: 'e2e.admin@example.test', role: 'ADMIN' };

/** The two people nobody harms: other specs sign in as them, and the saved browser state is the Lead's. */
export const E2E_USERS: ReadonlyArray<E2eUser> = [E2E_LEAD, E2E_ENGINEER];

/**
 * Someone whose details only a refused request could reveal: the production-build spec of `/users` (TD-06) looks for this
 * name and address in everything a Lead and an Engineer are sent, and must find neither.
 */
export const E2E_CANARY: Pick<E2eUser, 'name' | 'email'> = { name: 'E2E Canary Person', email: 'e2e.canary.person@example.test' };

/**
 * What a test may do to a person it makes for itself (DL-085):
 *   slip     gets wrong passwords, which count toward the five-failure block;
 *   axe      gets one wrong password for the accessibility check of the error state;
 *   sign-out signs out, which ends every session of that person;
 *   managed  is changed by the Admin on the Users screen (renamed, reset, deactivated), STORY-01.04;
 *   scan     is the Engineer whom the confidentiality scan signs in as (STORY-01.03), so no other spec's sign-out or lock-out reaches it;
 *   expiry   holds a session that ended and signs in again (STORY-01.06), which writes no failure and raises no `session_version`;
 *   queue    is an Engineer with no task of their own, to whom the queue spec (STORY-04.02) assigns the tasks it needs and no others (a `scan` person owns a canary task);
 *   bell     is a Lead (or an Admin, by the `role` argument) whose bell count the bell spec (STORY-04.03) reads: it assigns, or is assigned, only the tasks that spec seeds
 *            for it, so the count it reads is its own whatever other specs seed in the shared database;
 *   password changes their own password on the account page (STORY-01.05), which raises `session_version` and counts wrong current passwords
 *            on a key of its own; nobody else's sessions or counts are touched.
 * Each run of each test gets a person of its own, made when the test starts, so the spec can be repeated
 * (`--repeat-each`), retried and run at three widths at the same time without one run's failures, block or sign-out
 * reaching another's. Nobody else is ever signed out or blocked.
 */
export type DisposableKind = 'slip' | 'axe' | 'sign-out' | 'managed' | 'scan' | 'expiry' | 'password' | 'queue' | 'bell';

const UPSERT_USER = `
  INSERT INTO users (name, email, password_hash, role, is_active, must_change_password)
  VALUES ($1, $2, $3, $4::user_role, true, false)
  ON CONFLICT (email) DO UPDATE
    SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
        is_active = true, must_change_password = false, session_version = 0`;

/** Opens a connection to the database the servers use, after the same guard as every test run (never a live database). */
async function connectToTestDatabase(): Promise<Client> {
  const url = process.env['DATABASE_URL'];
  if (url === undefined || url === '') {
    throw new Error('DATABASE_URL is not set. Start the test database and set it as the README says (docker compose -f compose.dev.yml up -d db).');
  }
  assertSafeDatabaseTarget({ ...process.env, DATABASE_URL: url });
  const client = new Client({ connectionString: url });
  await client.connect();
  return client;
}

/**
 * Makes sure the invented users exist with the known password, in the database the servers use. The URL is judged
 * by the same guard as every test run, so this can never write to a live database. Needs a migrated database.
 */
export async function ensureE2eUsers(): Promise<void> {
  const hash = await createTestHasher().hash(E2E_PASSWORD);
  const client = await connectToTestDatabase();
  try {
    for (const user of E2E_USERS) await client.query(UPSERT_USER, [user.name, user.email, hash, user.role]);
    // Failures counted by an earlier run must not carry over into this one. Throwaway test database only (guarded above).
    await client.query('DELETE FROM login_throttles');
  } finally {
    await client.end();
  }
}

/**
 * Makes `E2E_ADMIN` the one active Admin, for the Users spec. The portal allows one active Admin, and this database may
 * already have another (the performance checks' invented Admin, `bootstrap-admin`'s), so any other active Admin is
 * deactivated first. That is a change to a person who may matter, so it runs only against a database that is thrown away
 * (the same rule as `ensure-measurement-user`: this machine or the CI service, never staging).
 */
export async function ensureE2eAdmin(): Promise<void> {
  const url = process.env['DATABASE_URL'];
  if (url === undefined || url === '') throw new Error('DATABASE_URL is not set. Start the test database and set it as the README says.');
  assertThrowawayDatabase(url, process.env['NODE_ENV']);
  const hash = await createTestHasher().hash(E2E_PASSWORD);
  const client = await connectToTestDatabase();
  try {
    await client.query("UPDATE users SET is_active = false, session_version = session_version + 1 WHERE role = 'ADMIN' AND is_active AND email <> $1", [E2E_ADMIN.email]);
    await client.query(UPSERT_USER, [E2E_ADMIN.name, E2E_ADMIN.email, hash, E2E_ADMIN.role]);
    await client.query('DELETE FROM login_throttles');
  } finally {
    await client.end();
  }
}

/** Makes sure the canary person exists (an Engineer, so the one-Admin rule is not touched) and returns their ID. */
export async function ensureCanaryUser(): Promise<string> {
  const hash = await createTestHasher().hash(E2E_PASSWORD);
  const client = await connectToTestDatabase();
  try {
    const { rows } = await client.query<{ id: string }>(`${UPSERT_USER} RETURNING id`, [E2E_CANARY.name, E2E_CANARY.email, hash, 'ENGINEER']);
    const id = rows[0]?.id;
    if (id === undefined) throw new Error('The canary person could not be made.');
    return id;
  } finally {
    await client.end();
  }
}

/**
 * The label of an audit entry that only a refused request could reveal: the production-build spec of `/audit` (STORY-01.07 AC-7)
 * looks for it in everything a Lead and an Engineer are sent, and must find it nowhere.
 */
export const E2E_AUDIT_CANARY_LABEL = 'E2E Audit Canary Entry';

/**
 * Makes sure one audit entry carries `E2E_AUDIT_CANARY_LABEL`, made by the canary person about the canary person. The audit table
 * is append-only, so the entry is added once and stays; the runtime role may add to it (that is how the portal writes it).
 */
export async function ensureAuditCanaryEntry(): Promise<void> {
  const canaryId = await ensureCanaryUser();
  const client = await connectToTestDatabase();
  try {
    await client.query(
      `INSERT INTO audit_log (actor_id, actor_label, event, object_type, object_id, object_label, before, after, request_id)
       SELECT $1::uuid, $2::text, 'user.created', 'user', $1::uuid, $2::text, NULL, '{"role":"ENGINEER","isActive":true}'::jsonb, 'req-00000000'
       WHERE NOT EXISTS (SELECT 1 FROM audit_log WHERE object_label = $2)`,
      [canaryId, E2E_AUDIT_CANARY_LABEL],
    );
  } finally {
    await client.end();
  }
}

/**
 * Gives the Engineer with this ID a task and its estimate for the confidentiality scan (STORY-05.01; `tests/support/estimate-recipe.ts`): both have the Engineer's own ID,
 * and the task a code made from it in a year no real task has, so the scan's recipes (`/estimates/<code>`, `PUT /api/v1/estimates/<id>/customer`) name a record the
 * signed-in Engineer really owns. Assigned by the E2E Lead. Inserts that do nothing on any conflict, so a repeat is safe. Invented values; the database is thrown away.
 */
async function insertCanaryEstimate(client: Client, ownerId: string): Promise<void> {
  const { rows } = await client.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [E2E_LEAD.email]);
  const lead = rows[0];
  if (lead === undefined) throw new Error('The E2E Lead does not exist yet: the set-up project makes it.');
  await client.query(
    `INSERT INTO tasks (id, code, engineer_id, assigned_by, folder_path, deadline_at, title, notes)
     VALUES ($1::uuid, $2, $1::uuid, $3::uuid, $4, '2099-01-01T04:30:00Z', 'Canary task', 'Invented notes.') ON CONFLICT DO NOTHING`,
    [ownerId, canaryTaskCodeFor(ownerId), lead.id, CANARY_FOLDER_PATH],
  );
  await client.query('INSERT INTO estimates (id, task_id) VALUES ($1::uuid, $1::uuid) ON CONFLICT DO NOTHING', [ownerId]);
  // The one part the node routes of STORY-05.02 open: its ID is the estimate's too (`estimate-recipe.ts`), first at the top.
  await client.query('INSERT INTO estimate_nodes (id, estimate_id, sort_index) VALUES ($1::uuid, $1::uuid, 0) ON CONFLICT DO NOTHING', [ownerId]);
}

/**
 * Makes a person for one run of one test, with the shared invented password, and returns them. The e-mail names the
 * kind, the screen size, the repeat and the retry, plus a random part, so no two runs ever share it. The rows stay in
 * the throwaway database (the runtime role cannot delete users); they are all `e2e.*@example.test`.
 */
export async function createDisposableUser(kind: DisposableKind, testInfo: TestInfo, role: E2eUser['role'] = 'ENGINEER'): Promise<E2eUser & { readonly id: string }> {
  const part = randomBytes(3).toString('hex');
  const label = `${kind}.${testInfo.project.name}.r${testInfo.repeatEachIndex}.t${testInfo.retry}.${part}`;
  const user: E2eUser = { name: `E2E ${label}`, email: `e2e.${label}@example.test`, role };
  const hash = await createTestHasher().hash(E2E_PASSWORD);
  const client = await connectToTestDatabase();
  try {
    const { rows } = await client.query<{ id: string }>(`${UPSERT_USER} RETURNING id`, [user.name, user.email, hash, user.role]);
    const id = rows[0]?.id;
    if (id === undefined) throw new Error('The disposable person could not be made.');
    // The scan's person owns a task with an estimate, which the recipes of the workspace page and the customer route open (STORY-05.01).
    if (kind === 'scan') await insertCanaryEstimate(client, id);
    // The ID goes with the person so a scan can open the record that person really owns (STORY-01.03 AC-6, QLT-02).
    return { ...user, id };
  } finally {
    await client.end();
  }
}

/**
 * Puts a material into the one part of the canary estimate of a person made by `createDisposableUser('scan', ...)` (the part has the owner's ID too,
 * `insertCanaryEstimate`), the way the part form of STORY-05.03 will: the material's ID inside the value of a field. The delete guard of STORY-02.07 finds the ID
 * wherever it is in the inputs, so the key and the shape here are invented. The estimate is a Draft, so the material is then "in use" (AC-3).
 */
export async function putMaterialInCanaryPart(ownerId: string, materialId: string): Promise<void> {
  const client = await connectToTestDatabase();
  try {
    await client.query(
      `UPDATE estimate_nodes SET inputs = jsonb_build_object('invented-material-field', jsonb_build_object('id', $2::text, 'text', 'Invented material')) WHERE id = $1::uuid`,
      [ownerId, materialId],
    );
  } finally {
    await client.end();
  }
}

/**
 * Fills the one part of the canary estimate of a person made by `createDisposableUser('scan', ...)` the way the scan needs it (STORY-05.04 AC-7; review SQR-05 of STORY-05.03;
 * `tests/support/canary-part-inputs.ts`): every value an Engineer types into the part form, stored as the form stores it (Tool, Machining, Plating and Fasteners Cost among them), and,
 * beside them, a canary price under Material Rate / Kg and a key that is no field. The routes that return a part, and the page, must send the typed values and never the other two, so
 * the scan reads a part that really holds a Restricted value. Only the scan's own person has such a part, so no other spec sees it. The statement replaces the inputs and is repeatable.
 */
export async function fillCanaryPart(ownerId: string): Promise<void> {
  const client = await connectToTestDatabase();
  try {
    // The registry is the newest version stored in this database, which the server's form is built from. It is read as stored: a Playwright process cannot load the formula engine that
    // `parseConfigDocument` uses, and the shape was checked when the version was written.
    const { rows } = await client.query<{ snapshot: unknown }>('SELECT snapshot FROM config_versions ORDER BY number DESC LIMIT 1');
    const snapshot = registryShape.parse(rows[0]?.snapshot);
    const inputs = canaryPartInputs(snapshot as unknown as ConfigDocument);
    await client.query('UPDATE estimate_nodes SET inputs = $2::jsonb WHERE id = $1::uuid', [ownerId, JSON.stringify(inputs)]);
  } finally {
    await client.end();
  }
}

/**
 * Puts the Process Master canary rates (STORY-02.01's name and values, `tests/support/process-master-canary.ts`) into the database
 * the servers use, so the confidentiality scan has Restricted values to look for. They are three new rates, never the 15 seed rows
 * that other specs read, and the statement is repeatable and safe when three screen sizes run it at once (`ON CONFLICT DO NOTHING`,
 * then an update to the same value). A rate is not secret: the values are invented and this database is thrown away (guarded above).
 */
export async function ensureCanaryProcessRates(): Promise<void> {
  const client = await connectToTestDatabase();
  try {
    for (const rate of PROCESS_CANARY_RATES) {
      const insert = 'INSERT INTO process_items (name, unit, default_value) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING';
      await client.query(insert, [rate.name, rate.unit, rate.value]);
      await client.query('UPDATE process_items SET default_value = $2 WHERE lower(name) = lower($1)', [rate.name, rate.value]);
    }
  } finally {
    await client.end();
  }
}

/**
 * Puts the Material Master canary materials (STORY-02.03's names, IDs and numbers, `tests/support/material-master-canary.ts`) into the
 * database the servers use, so the confidentiality scan has a price, a specific gravity and a Material-Scrap-Rate to look for, and the
 * recipe for `PATCH /api/v1/materials/{id}` names a material that exists. The statements are `loadCanaryMaterials`: an insert that does
 * nothing on any conflict, then an update by ID, so several loaders at once (three screen sizes) cannot fail on a name index. A committed
 * integration test runs three of them at once over many rounds. The numbers are invented and this database is thrown away (guarded above).
 */
export async function ensureCanaryMaterials(): Promise<void> {
  const client = await connectToTestDatabase();
  try {
    await loadCanaryMaterials(client);
  } finally {
    await client.end();
  }
}

/**
 * Puts the Customer Master canary customer (STORY-02.02's name, ID, phone and rates, `tests/support/customer-canary.ts`) into the database the servers use,
 * so the confidentiality scan has a customer's rates and phone number to look for, and the recipes for `PATCH /api/v1/customers/{id}` and the edit page name a
 * customer that exists. The statements are `loadCanaryCustomers`: inserts that do nothing on any conflict (so several loaders at once cannot fail on a name
 * index), a rate row for every Process Master item the customer lacks, then an update of the two canary rates. The numbers are invented and this database
 * is thrown away (guarded above).
 */
export async function ensureCanaryCustomers(): Promise<void> {
  const client = await connectToTestDatabase();
  try {
    await loadCanaryCustomers(client);
  } finally {
    await client.end();
  }
}

/** A second customer for the workspace spec (STORY-05.01), so there is another to change to. Not a canary: it has no rates of its own beyond the defaults. */
export const E2E_SECOND_CUSTOMER = 'E2E Second Customer';

/**
 * Makes sure `E2E_SECOND_CUSTOMER` exists, with a rate row at the default for every Process Master item (the same shape as any customer made on SCR-12). Inserts that do
 * nothing on any conflict, so three screen sizes running it at once cannot fail on the name index. Throwaway database only (guarded above).
 */
export async function ensureE2eSecondCustomer(): Promise<string> {
  const client = await connectToTestDatabase();
  try {
    await client.query('INSERT INTO customers (name) VALUES ($1) ON CONFLICT DO NOTHING', [E2E_SECOND_CUSTOMER]);
    const { rows } = await client.query<{ id: string }>('SELECT id::text AS id FROM customers WHERE name = $1', [E2E_SECOND_CUSTOMER]);
    const id = rows[0]?.id;
    if (id === undefined) throw new Error('The second E2E customer could not be made.');
    await client.query('INSERT INTO customer_rates (customer_id, process_item_id, value) SELECT $1::uuid, id, default_value FROM process_items ON CONFLICT DO NOTHING', [id]);
    return id;
  } finally {
    await client.end();
  }
}

/** The exchange rates the database holds now, as the stored text per currency (QLT-02: the scan checks its precondition at the end). */
export async function readExchangeRatesFromDatabase(): Promise<Record<string, string>> {
  const client = await connectToTestDatabase();
  try {
    const { rows } = await client.query<{ currency: string; inr_value: string }>('SELECT currency, inr_value::text AS inr_value FROM exchange_rates');
    return Object.fromEntries(rows.map((row) => [row.currency, row.inr_value]));
  } finally {
    await client.end();
  }
}

/**
 * Puts the canary exchange rates (STORY-02.04's values, `tests/support/exchange-rate-canary.ts`) into the database the servers use, stamped by the E2E
 * Admin, so the confidentiality scan has a USD and a EUR rate to look for. The upsert is on the currency (the primary key), so three screen sizes
 * running it at once cannot fail on a conflict, and it needs no retry. The set-up project makes the Admin before any spec runs. The values are invented
 * and this database is thrown away (guarded above).
 */
export async function ensureCanaryExchangeRates(): Promise<void> {
  const client = await connectToTestDatabase();
  try {
    const { rows } = await client.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [E2E_ADMIN.email]);
    const admin = rows[0];
    if (admin === undefined) throw new Error('The E2E Admin does not exist yet: the set-up project makes it.');
    const upsert = `INSERT INTO exchange_rates (currency, inr_value, updated_by) VALUES ($1, $2, $3)
      ON CONFLICT (currency) DO UPDATE SET inr_value = EXCLUDED.inr_value, updated_by = EXCLUDED.updated_by, updated_at = now()`;
    await client.query(upsert, ['USD', EXCHANGE_RATE_CANARIES.usd, admin.id]);
    await client.query(upsert, ['EUR', EXCHANGE_RATE_CANARIES.eur, admin.id]);
  } finally {
    await client.end();
  }
}

/** The registry as stored: its sections and fields are lists (every other property is the registry's own schema's, checked when the version was written). */
const registryShape = z.looseObject({ sections: z.array(z.looseObject({})), fields: z.array(z.looseObject({ id: z.string(), key: z.string() })) });

const snapshotShape = z.looseObject({
  fields: z.array(z.looseObject({ id: z.string(), position: z.number().int(), formula: z.string().nullish() })),
});

/**
 * Every stored formula of the newest configuration version, in its internal form AND in the display form a careless view would print
 * (QLT-05), so the scan can look for the text itself. The Process master page reads that version, so the E2E database already has one
 * (CI makes version 1 before the tests). The display form needs the rates' names, which are read from the Process Master.
 */
export async function readFormulaTexts(): Promise<ReadonlyArray<string>> {
  const client = await connectToTestDatabase();
  try {
    const { rows } = await client.query<{ snapshot: unknown }>('SELECT snapshot FROM config_versions ORDER BY number DESC LIMIT 1');
    const rates = await client.query<{ id: string; name: string }>('SELECT id, name FROM process_items');
    const snapshot = snapshotShape.parse(rows[0]?.snapshot);
    const context = {
      positionOf: new Map(snapshot.fields.map((field) => [field.id, field.position])),
      rateNameOf: new Map(rates.rows.map((rate) => [rate.id, rate.name])),
    };
    const internal = snapshot.fields.flatMap((field) => (typeof field.formula === 'string' && field.formula.length > 0 ? [field.formula] : []));
    return [...internal, ...internal.map((text) => displayFormOf(text, context))];
  } finally {
    await client.end();
  }
}

/**
 * An e-mail address nobody has, for one run of one test. A failed attempt counts against the address even when no one
 * owns it (the lock-out must not tell the two apart, AC-2 and AC-3), so a fixed unknown address would be blocked after
 * five runs. Like `createDisposableUser`, the name carries the screen size, the repeat and the retry, plus a random part.
 */
export function unknownEmail(testInfo: TestInfo): string {
  const part = randomBytes(3).toString('hex');
  return `e2e.nobody.${testInfo.project.name}.r${testInfo.repeatEachIndex}.t${testInfo.retry}.${part}@example.test`;
}

/**
 * A fresh made-up client address for a test, sent as `X-Forwarded-For` the way the proxy would, so the per-address
 * limit (30 failures in 15 minutes) of one test, run or retry never counts against another.
 */
export async function useFreshAddress(context: BrowserContext): Promise<void> {
  // Two random octets: 65,000 addresses, so many repeats do not meet on one.
  const address = `198.51.${randomInt(0, 256)}.${randomInt(1, 255)}`;
  const second = `203.0.113.${randomInt(1, 255)}`;
  await context.setExtraHTTPHeaders({ 'x-forwarded-for': `${second}, ${address}` });
}

/**
 * Fills SCR-01 and presses "Sign in". It first waits for the form to be hydrated (its `onSubmit` attached): typed text
 * and a press on the button before that are lost or become a plain form post (QLT-51, the same fault as DEF-011).
 */
export async function signInThroughThePage(page: Page, email: string, password: string): Promise<void> {
  await waitUntilHydrated(page, 'form[aria-label="Sign in"]', 'onSubmit');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

export async function expectOnQueue(page: Page, title: string): Promise<void> {
  await expect(page).toHaveURL(/\/queue$/);
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
}
