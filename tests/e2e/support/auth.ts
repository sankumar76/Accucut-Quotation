import { randomInt } from 'node:crypto';

import { expect, type BrowserContext, type Page } from '@playwright/test';
import { Client } from 'pg';

import { assertSafeDatabaseTarget } from '../../support/db-guard';
import { createTestHasher } from '../../support/builders/user';

/**
 * Shared by the sign-in journey (`sign-in.spec.ts`), the set-up project (`auth.setup.ts`) and the playwright
 * configuration. This file has no tests and its name does not end in `.spec.ts`.
 */

/** Invented people for the journey. `.test` is a reserved domain; the password exists only here. */
export const E2E_PASSWORD = 'invented-e2e-password-for-aqp-38';

export interface E2eUser {
  readonly name: string;
  readonly email: string;
  readonly role: 'LEAD' | 'ENGINEER';
}

export const E2E_LEAD: E2eUser = { name: 'E2E Lead', email: 'e2e.lead@example.test', role: 'LEAD' };
export const E2E_ENGINEER: E2eUser = { name: 'E2E Engineer', email: 'e2e.engineer@example.test', role: 'ENGINEER' };
/** Used only by the wrong-password test, so its failures never touch the people other tests sign in as. */
export const E2E_WRONG_PASSWORD_USER: E2eUser = { name: 'E2E Slip', email: 'e2e.slip@example.test', role: 'ENGINEER' };
export const E2E_USERS: ReadonlyArray<E2eUser> = [E2E_LEAD, E2E_ENGINEER, E2E_WRONG_PASSWORD_USER];

const UPSERT_USER = `
  INSERT INTO users (name, email, password_hash, role, is_active, must_change_password)
  VALUES ($1, $2, $3, $4::user_role, true, false)
  ON CONFLICT (email) DO UPDATE
    SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
        is_active = true, must_change_password = false, session_version = 0`;

/**
 * Makes sure the invented users exist with the known password, in the database the servers use. The URL is judged
 * by the same guard as every test run, so this can never write to a live database. Needs a migrated database.
 */
export async function ensureE2eUsers(): Promise<void> {
  const url = process.env['DATABASE_URL'];
  if (url === undefined || url === '') {
    throw new Error('DATABASE_URL is not set. Start the test database and set it as the README says (docker compose -f compose.dev.yml up -d db).');
  }
  assertSafeDatabaseTarget({ ...process.env, DATABASE_URL: url });
  const hash = await createTestHasher().hash(E2E_PASSWORD);
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    for (const user of E2E_USERS) await client.query(UPSERT_USER, [user.name, user.email, hash, user.role]);
  } finally {
    await client.end();
  }
}

/**
 * A fresh made-up client address for a test, sent as `X-Forwarded-For` the way the proxy would, so the per-address
 * limit (30 failures in 15 minutes) of one test, run or retry never counts against another.
 */
export async function useFreshAddress(context: BrowserContext): Promise<void> {
  const address = `198.51.100.${randomInt(1, 255)}`;
  const second = `203.0.113.${randomInt(1, 255)}`;
  await context.setExtraHTTPHeaders({ 'x-forwarded-for': `${second}, ${address}` });
}

/** Fills SCR-01 with the keyboard-free helpers and presses "Sign in". */
export async function signInThroughThePage(page: Page, email: string, password: string): Promise<void> {
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

export async function expectOnQueue(page: Page, title: string): Promise<void> {
  await expect(page).toHaveURL(/\/queue$/);
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
}
