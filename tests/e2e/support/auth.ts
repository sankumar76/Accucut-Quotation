import { randomBytes, randomInt } from 'node:crypto';

import { expect, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import { Client } from 'pg';

import { assertThrowawayDatabase } from '../../../scripts/lib/measurement-user';
import { assertSafeDatabaseTarget } from '../../support/db-guard';
import { createTestHasher } from '../../support/builders/user';

import { waitUntilHydrated } from './design-system';

/**
 * Shared by the sign-in journey (`sign-in.spec.ts`), the set-up project (`auth.setup.ts`) and the playwright
 * configuration. This file has no tests and its name does not end in `.spec.ts`.
 */

/** Invented people for the journey. `.test` is a reserved domain; the password exists only here. */
export const E2E_PASSWORD = 'invented-e2e-password-for-aqp-38';

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
 *   managed  is changed by the Admin on the Users screen (renamed, reset, deactivated), STORY-01.04.
 * Each run of each test gets a person of its own, made when the test starts, so the spec can be repeated
 * (`--repeat-each`), retried and run at three widths at the same time without one run's failures, block or sign-out
 * reaching another's. Nobody else is ever signed out or blocked.
 */
export type DisposableKind = 'slip' | 'axe' | 'sign-out' | 'managed';

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
      `INSERT INTO audit_log (actor_id, event, object_type, object_id, object_label, before, after, request_id)
       SELECT $1::uuid, 'user.created', 'user', $1::uuid, $2, NULL, '{"role":"ENGINEER","isActive":true}'::jsonb, 'req-00000000'
       WHERE NOT EXISTS (SELECT 1 FROM audit_log WHERE object_label = $2)`,
      [canaryId, E2E_AUDIT_CANARY_LABEL],
    );
  } finally {
    await client.end();
  }
}

/**
 * Makes a person for one run of one test, with the shared invented password, and returns them. The e-mail names the
 * kind, the screen size, the repeat and the retry, plus a random part, so no two runs ever share it. The rows stay in
 * the throwaway database (the runtime role cannot delete users); they are all `e2e.*@example.test`.
 */
export async function createDisposableUser(kind: DisposableKind, testInfo: TestInfo): Promise<E2eUser> {
  const part = randomBytes(3).toString('hex');
  const label = `${kind}.${testInfo.project.name}.r${testInfo.repeatEachIndex}.t${testInfo.retry}.${part}`;
  const user: E2eUser = { name: `E2E ${label}`, email: `e2e.${label}@example.test`, role: 'ENGINEER' };
  const hash = await createTestHasher().hash(E2E_PASSWORD);
  const client = await connectToTestDatabase();
  try {
    await client.query(UPSERT_USER, [user.name, user.email, hash, user.role]);
  } finally {
    await client.end();
  }
  return user;
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
