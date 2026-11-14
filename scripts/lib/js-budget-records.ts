/**
 * The records the JS budget check opens a dynamic route at (STORY-10.10 AC-2; first used by STORY-02.02's `/masters/customers/[id]`, then STORY-05.01's `/estimates/[code]`).
 *
 * A page with a dynamic segment can only be requested at a record that exists. The check makes one from invented data through the portal's own API,
 * signed in as the invented Admin, and hands the path to `buildTargets` (`recordPaths`). The throwaway database it runs against is the one the Admin was
 * made in (`scripts/ensure-measurement-user.ts`), so the records are never cleaned up. The customer is one customer; the estimate is one task, assigned to
 * an Engineer the check adds first (an estimate is made only with a task, and a task only for an active Engineer). When a record cannot be made (no Admin
 * sign-in, the portal refused, an answer without an ID), no path is returned for that route: the route then fails with "a dynamic segment needs a record
 * made from invented data, and none could be made", and one line on stderr says which step failed. Nothing is skipped silently, and no credential or
 * cookie is ever printed.
 */
import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { signIn, type CredentialsProvider } from './js-budget-http';

/** The route pattern of the customer's page, as the route manifest spells it. */
export const CUSTOMER_PAGE_ROUTE = '/masters/customers/[id]';
/** The route pattern of the estimate workspace, as the route manifest spells it. */
export const ESTIMATE_PAGE_ROUTE = '/estimates/[code]';
const CUSTOMERS_API_PATH = '/api/v1/customers';
const USERS_API_PATH = '/api/v1/users';
const TASKS_API_PATH = '/api/v1/tasks';
const REQUEST_TIMEOUT_MS = 30_000;
const CREATED = 201;

/** An invented UNC path and a deadline far in the future, so the task is accepted whenever the check runs. */
const BUDGET_FOLDER_PATH = '\\\\budget-check-server\\budget-check-share\\RFQ-budget';
const BUDGET_DEADLINE = '2099-01-01T10:00';

const idSchema = z.object({ id: z.string().min(1) });
const codeSchema = z.object({ code: z.string().min(1) });

export interface RecordOptions {
  readonly baseUrl: string;
  readonly credentialsFor: CredentialsProvider;
  readonly fetchImpl?: typeof fetch;
  /** Where the one line about a record that could not be made goes. */
  readonly warn?: (line: string) => void;
}

/** A signed-in Admin: the way to ask the portal for a record. */
interface AdminCall {
  post(path: string, body: unknown): Promise<unknown>;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : 'unexpected error';
}

/** Signs the Admin in once, and returns a function that POSTs JSON as them and answers the body of a 201; anything else is an error naming the path. */
async function signedInAdmin(options: RecordOptions): Promise<AdminCall | undefined> {
  const credentials = options.credentialsFor('ADMIN');
  if (credentials === undefined) return undefined;
  const fetchImpl = options.fetchImpl ?? fetch;
  const cookie = await signIn(options.baseUrl, credentials, fetchImpl);
  return {
    async post(path, body) {
      const response = await fetchImpl(`${options.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', cookie, origin: new URL(options.baseUrl).origin },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.status !== CREATED) throw new Error(`POST ${path} answered HTTP ${response.status}, not 201`);
      return response.json();
    },
  };
}

/** Adds one customer named from a random UUID (invented, and unique so a second run does not collide) and returns the path of its page. */
async function makeCustomerPath(admin: AdminCall): Promise<string> {
  const created = idSchema.safeParse(await admin.post(CUSTOMERS_API_PATH, { name: `Budget check customer ${randomUUID()}` }));
  if (!created.success) throw new Error(`POST ${CUSTOMERS_API_PATH} did not answer with the customer's ID`);
  return `/masters/customers/${encodeURIComponent(created.data.id)}`;
}

/** Adds an invented Engineer, assigns them one task and returns the path of its workspace. */
async function makeEstimatePath(admin: AdminCall): Promise<string> {
  const unique = randomUUID();
  const engineer = idSchema.safeParse(
    await admin.post(USERS_API_PATH, { name: `Budget check engineer ${unique}`, email: `budget-check-${unique}@example.test`, role: 'ENGINEER', password: `${unique}-Aa1!` }),
  );
  if (!engineer.success) throw new Error(`POST ${USERS_API_PATH} did not answer with the Engineer's ID`);
  const task = codeSchema.safeParse(
    await admin.post(TASKS_API_PATH, { engineerId: engineer.data.id, folderPath: BUDGET_FOLDER_PATH, deadline: BUDGET_DEADLINE, title: 'Budget check task', notes: 'Invented.' }),
  );
  if (!task.success) throw new Error(`POST ${TASKS_API_PATH} did not answer with the task's code`);
  return `/estimates/${encodeURIComponent(task.data.code)}`;
}

/** The paths of the records made for the dynamic routes, keyed by route pattern. A route whose record could not be made is left out, with a line saying why. */
export async function makeRecordPaths(options: RecordOptions): Promise<Readonly<Record<string, string>>> {
  const warn = options.warn ?? ((line: string) => void process.stderr.write(`${line}\n`));
  let admin: AdminCall | undefined;
  try {
    admin = await signedInAdmin(options);
  } catch (error: unknown) {
    for (const route of [CUSTOMER_PAGE_ROUTE, ESTIMATE_PAGE_ROUTE]) warn(`JS budget: no record was made for ${route}: ${describe(error)}`);
    return {};
  }
  if (admin === undefined) return {};
  const makers: ReadonlyArray<readonly [string, (call: AdminCall) => Promise<string>]> = [
    [CUSTOMER_PAGE_ROUTE, makeCustomerPath],
    [ESTIMATE_PAGE_ROUTE, makeEstimatePath],
  ];
  const paths: Record<string, string> = {};
  for (const [route, make] of makers) {
    try {
      paths[route] = await make(admin);
    } catch (error: unknown) {
      warn(`JS budget: no record was made for ${route}: ${describe(error)}`);
    }
  }
  return paths;
}
