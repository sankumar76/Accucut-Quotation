import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { failure } from '../../support/fake-settings';
import { harness, holdSessionClock, releaseSessionClock } from '../../support/session-harness';

/**
 * STORY-09.02 AC-2 to AC-6 at the routes, with the settings row, the users and the mail in memory: `GET` and `PUT /api/v1/settings` and `POST /api/v1/settings/test-email`. The role is
 * checked first and a refusal changes, reads and sends nothing; a save answers the row as saved or one message per field; the test e-mail goes to the signed-in Admin's own address and
 * never to an address in a body; a failure is a 502 with a class code and the generic title, with no server word in it. The page draws the Admin's own address. Every address is invented.
 */

vi.mock('next-auth', async () => ({ getServerSession: (await import('../../support/session-harness')).harness.getServerSession }));
vi.mock('next/headers', async () => ({ headers: (await import('../../support/session-harness')).harness.headers }));
vi.mock('next/navigation', async () => {
  const { harness: shared } = await import('../../support/session-harness');
  return { redirect: shared.redirect, forbidden: shared.forbidden, notFound: shared.notFound };
});
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T): T => fn }));
vi.mock('@/server/composition', async () => {
  const { harness: shared } = await import('../../support/session-harness');
  return { getAuthOptions: () => ({}), getUserRepository: () => shared.users, getSettingsService: () => shared.settingsService };
});

const { default: SettingsPage } = await import('@/app/(portal)/settings/page');
const { GET, PUT } = await import('@/app/api/v1/settings/route');
const { POST } = await import('@/app/api/v1/settings/test-email/route');

const ORIGIN = 'https://portal.example.test';
const ADMIN_ADDRESS = 'invented.admin@example.test';
const OTHER_ADDRESS = 'someone.else@example.com';
const SAVED = { alertsEnabled: true, senderName: 'Accucut Portal', senderAddress: 'portal@example.com' };

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);
beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  harness.settingsRepository.current = { alertsEnabled: false, senderName: '', senderAddress: '' };
  harness.settingsRepository.writes.length = 0;
  harness.settingsRepository.reads.count = 0;
  harness.settingsMail.sent.length = 0;
  harness.settingsMail.result = null;
});

function send(method: 'GET' | 'PUT' | 'POST', path: string, body?: unknown): Request {
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers: { origin: ORIGIN, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
const put = (body: unknown): Promise<Response> => PUT(send('PUT', '/api/v1/settings', body));
const post = (body?: unknown): Promise<Response> => POST(send('POST', '/api/v1/settings/test-email', body));

interface Problem {
  readonly status: number;
  readonly code: string;
  readonly title: string;
  readonly errors?: ReadonlyArray<{ readonly field: string; readonly message: string }>;
}

describe('AC-2: GET adds the alerts to the backups, and nothing else can leave', () => {
  it('has the four new fields with the saved values and the flag', async () => {
    harness.signInAs('ADMIN');
    harness.settingsRepository.current = SAVED;
    const body = (await (await GET(send('GET', '/api/v1/settings'))).json()) as Record<string, unknown>;
    expect(body).toMatchObject({ alertsEnabled: true, senderName: 'Accucut Portal', senderAddress: 'portal@example.com', emailEnabled: false });
    expect(Object.keys(body).sort()).toEqual(['alertsEnabled', 'backupLate', 'diskNearlyFull', 'diskReading', 'emailEnabled', 'lastGoodBackupAt', 'senderAddress', 'senderName']);
  });
});

describe('AC-3: PUT /settings', () => {
  it('saves the three values and answers the row as saved', async () => {
    harness.signInAs('ADMIN');
    const response = await put({ alertsEnabled: true, senderName: ' Accucut Portal ', senderAddress: ' portal@example.com ' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ...SAVED, emailEnabled: false });
    expect(harness.settingsRepository.current).toEqual(SAVED);
  });

  it('answers 422 with one message per field, both at once, and saves nothing', async () => {
    harness.signInAs('ADMIN');
    const response = await put({ alertsEnabled: true, senderName: '', senderAddress: 'nope' });
    expect(response.status).toBe(422);
    const problem = (await response.json()) as Problem;
    expect(problem.errors?.map((entry) => entry.field)).toEqual(['senderName', 'senderAddress']);
    expect(harness.settingsRepository.writes).toEqual([]);
  });

  it('refuses a body with a key it does not name (strict): the row is the three values and nothing else', async () => {
    harness.signInAs('ADMIN');
    const response = await put({ ...SAVED, smtpPassword: 'invented-password' });
    expect(response.status).toBe(422);
    expect(harness.settingsRepository.writes).toEqual([]);
  });

  it('answers 422 for a body of the wrong types', async () => {
    harness.signInAs('ADMIN');
    expect((await put({ alertsEnabled: 'yes', senderName: 1, senderAddress: null })).status).toBe(422);
  });
});

describe('AC-4: POST /settings/test-email', () => {
  beforeEach(() => {
    harness.settingsRepository.current = SAVED;
  });

  it("sends one message to the signed-in Admin's own address and says so", async () => {
    harness.signInAs('ADMIN');
    const response = await post();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sentTo: ADMIN_ADDRESS });
    expect(harness.settingsMail.sent.map((message) => message.to)).toEqual([ADMIN_ADDRESS]);
  });

  it('ignores a body that names another address: nobody else is sent anything', async () => {
    harness.signInAs('ADMIN');
    const response = await post({ to: OTHER_ADDRESS, recipient: OTHER_ADDRESS, cc: [OTHER_ADDRESS] });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sentTo: ADMIN_ADDRESS });
    expect(harness.settingsMail.sent.map((message) => message.to)).toEqual([ADMIN_ADDRESS]);
    expect(JSON.stringify(harness.settingsMail.sent)).not.toContain(OTHER_ADDRESS);
  });
});

describe('AC-5: failures carry a class code and no secret', () => {
  it.each(['SENDER_NOT_ALLOWED', 'AUTH_FAILED', 'CONNECTION', 'UNKNOWN'] as const)('%s is a 502 with that code, the generic title and nothing else', async (code) => {
    harness.signInAs('ADMIN');
    harness.settingsMail.result = failure(code);
    const response = await post();
    expect(response.status).toBe(502);
    const text = await response.text();
    const problem = JSON.parse(text) as Problem;
    expect(problem.code).toBe(code);
    expect(problem.title).toBe('Something went wrong on our side.');
    expect(text).not.toMatch(/password|secret|token|smtp|5\.7\.60|@/i);
  });

  it('no saved sender address is a 422 NO_SENDER with its own code, and the transport is not asked to send', async () => {
    harness.signInAs('ADMIN');
    const response = await post();
    expect(response.status).toBe(422);
    expect(((await response.json()) as Problem).code).toBe('NO_SENDER');
  });
});

describe('AC-6: roles', () => {
  it.each([
    ['LEAD', 403],
    ['ENGINEER', 403],
    [null, 401],
  ] as const)('%s gets %s from GET, PUT and POST test-email, and nothing is read, saved or sent', async (role, status) => {
    harness.signInAs(role);
    expect((await GET(send('GET', '/api/v1/settings'))).status).toBe(status);
    expect((await put(SAVED)).status).toBe(status);
    expect((await post({ to: OTHER_ADDRESS })).status).toBe(status);
    expect(harness.settingsRepository.reads.count).toBe(0);
    expect(harness.settingsRepository.writes).toEqual([]);
    expect(harness.settingsMail.sent).toEqual([]);
  });
});

describe('AC-1: the page draws the alerts and the Admin\'s own address', () => {
  it('has the alerts card with the saved values and the address the test e-mail goes to', async () => {
    harness.signInAs('ADMIN');
    harness.settingsRepository.current = SAVED;
    const html = renderToStaticMarkup(await SettingsPage());
    expect(html).toContain('role="switch"');
    expect(html).toContain('value="portal@example.com"');
    expect(html).toContain(`The test e-mail goes to your own address, ${ADMIN_ADDRESS}.`);
  });
});
