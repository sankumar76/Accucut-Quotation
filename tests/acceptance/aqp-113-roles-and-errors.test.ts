import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { entryCount } from '../support/audit-database';
import { PROCESS_MASTER_CANARIES, PROCESS_MASTER_CANARY_NAME, PROCESS_MASTER_CANARY_VALUES } from '../support/process-master-canary';
import { ORIGIN, FOREIGN_ORIGIN, world, call, NEW, create, idOf, db, adminId, leadId, engineerId, names, rowOf, serviceOverStoredVersions, openWorld, closeWorld, setUserId, loadProcessMasterRoutes, renderProcessPage } from '../support/process-master-api';

/**
 * QA acceptance, AQP-113 (STORY-02.01) AC-6 (the Admin only, the role checked first, CSRF, nothing about a rate to anyone else; the shared
 * canary of `tests/support/process-master-canary.ts`) and QLT-05 (a configuration that cannot be read stops a change before it writes).
 */

vi.mock('next-auth', async () => (await import('../support/process-master-api')).nextAuthMock());
vi.mock('next/headers', () => ({ headers: () => Promise.resolve(new Headers()) }));
vi.mock('next/navigation', async () => (await import('../support/process-master-api')).navigationMock());
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T): T => fn }));
vi.mock('@/server/composition', async () => (await import('../support/process-master-api')).compositionMock());

beforeAll(async () => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  await loadProcessMasterRoutes();
});

describe('the Process master over the API: roles, CSRF and the canary (AC-6)', () => {
  beforeAll(openWorld);
  afterAll(closeWorld);
  beforeEach(() => {
    vi.stubEnv('APP_ORIGIN', ORIGIN);
    setUserId(adminId);
  });
  describe('AC-6: Admin only, role first, no rate to anyone else', () => {
    // The one definition of the confidentiality canary (G6 ruling 5): a name and three values that no other test or fixture uses.
    const CANARY_NAME = PROCESS_MASTER_CANARY_NAME;
    const [CANARY_VALUE = ''] = PROCESS_MASTER_CANARY_VALUES;
    let canaryId: string;
    const wideOpenCalls = () =>
      [
        () => call('GET', null),
        () => call('POST', null, { name: 'Qa6-Intruder', ...NEW }),
        () => call('PATCH', canaryId, { defaultValue: '1.00' }),
        () => call('PATCH', '00000000-0000-4000-8000-0fffffffffff', { defaultValue: '1.00' }),
        () => call('DELETE', canaryId),
        () => call('DELETE', '00000000-0000-4000-8000-0fffffffffff'),
      ] as const;

    beforeAll(async () => {
      setUserId(adminId);
      canaryId = idOf(await create(CANARY_NAME, { defaultValue: CANARY_VALUE }));
    });

    it.each([
      { who: 'a Lead', whoId: () => leadId, status: 403 },
      { who: 'an Engineer', whoId: () => engineerId, status: 403 },
      { who: 'nobody (signed out)', whoId: () => null, status: 401 },
    ])('[AQP-113 AC-6] $who gets $status on all six calls, the same fixed body for a real and an invented ID, nothing about any rate, and nothing changes', async ({ whoId, status }) => {
      setUserId(whoId());
      const entries = await entryCount(db);
      const before = await names();
      const answers = [];
      for (const make of wideOpenCalls()) answers.push(await make());
      expect(answers.map((answer) => answer.status)).toEqual(Array.from({ length: 6 }, () => status));
      const withoutRequestId = answers.map((answer) => ({ ...answer.body, requestId: undefined }));
      for (const body of withoutRequestId) expect(body).toEqual(withoutRequestId[0]);
      for (const answer of answers) {
        for (const canary of PROCESS_MASTER_CANARIES) expect(answer.text).not.toContain(canary);
        expect(answer.text).not.toMatch(/defaultValue|usedBy|Cutting-Rate|Foam Cost/);
      }
      expect(await entryCount(db)).toBe(entries);
      expect(await names()).toEqual(before);
      expect((await rowOf(canaryId))?.default_value).toBe(`${CANARY_VALUE}00`);
    });

    it('[AQP-113 AC-6] the page /masters/process is for the Admin only: a Lead and an Engineer are sent to SCR-26 (forbidden), a signed-out visitor to sign-in', async () => {
      setUserId(leadId);
      await expect(renderProcessPage()).rejects.toThrow('NEXT_FORBIDDEN');
      setUserId(engineerId);
      await expect(renderProcessPage()).rejects.toThrow('NEXT_FORBIDDEN');
      setUserId(null);
      await expect(renderProcessPage()).rejects.toThrow(/NEXT_REDIRECT:\/sign-in/);
    });

    it('[AQP-113 AC-6] CSRF: a foreign Origin, no Origin and no Sec-Fetch-Site are refused 403 ORIGIN_REFUSED on POST, PATCH and DELETE; Sec-Fetch-Site same-origin is accepted', async () => {
      const entries = await entryCount(db);
      for (const origin of [FOREIGN_ORIGIN, null]) {
        for (const answer of [
          await call('POST', null, { name: 'Qa6-Csrf', ...NEW }, { origin }),
          await call('PATCH', canaryId, { defaultValue: '2.00' }, { origin }),
          await call('DELETE', canaryId, undefined, { origin }),
        ]) {
          expect(answer.status).toBe(403);
          expect(answer.body?.['code']).toBe('ORIGIN_REFUSED');
        }
      }
      expect(await entryCount(db)).toBe(entries);
      const sameSite = await call('PATCH', canaryId, { defaultValue: CANARY_VALUE }, { origin: null, extraHeaders: { 'sec-fetch-site': 'same-origin' } });
      expect(sameSite.status).toBe(200);
    });

    it('[AQP-113 AC-6] a deactivated Admin and a signed-out session (version raised) are refused at the next request (401), with nothing changed', async () => {
      setUserId(adminId);
      await db.owner.query('UPDATE users SET is_active = false WHERE id = $1', [adminId]);
      try {
        expect((await call('GET', null)).status).toBe(401);
        expect((await call('POST', null, { name: 'Qa6-Deactivated', ...NEW })).status).toBe(401);
      } finally {
        await db.owner.query('UPDATE users SET is_active = true WHERE id = $1', [adminId]);
      }
      await db.owner.query('UPDATE users SET session_version = session_version + 1 WHERE id = $1', [adminId]);
      try {
        expect((await call('GET', null)).status).toBe(401);
      } finally {
        await db.owner.query('UPDATE users SET session_version = session_version - 1 WHERE id = $1', [adminId]);
      }
      expect((await call('GET', null)).status).toBe(200);
      expect(await names()).not.toContain('Qa6-Deactivated');
    });

    it('[AQP-113 AC-6] the Admin sees the rate and its value (the canary reaches only the Admin)', async () => {
      setUserId(adminId);
      const list = await call('GET', null);
      expect(list.text).toContain(CANARY_NAME);
      expect(list.text).toContain(CANARY_VALUE);
    });

    it('[AQP-113 AC-6] the canary value and name appear in no refusal body the Admin was shown either (a 422 or 409 never echoes a value)', async () => {
      setUserId(adminId);
      for (const answer of [await call('PATCH', canaryId, { defaultValue: 'x' }), await call('POST', null, { name: CANARY_NAME, ...NEW })]) {
        for (const canary of PROCESS_MASTER_CANARIES) expect(answer.text).not.toContain(canary);
      }
    });
  });
});

describe('QLT-05: a configuration that cannot be read stops the change before anything is written', () => {
  beforeAll(openWorld);
  afterAll(closeWorld);
  beforeEach(() => {
    vi.stubEnv('APP_ORIGIN', ORIGIN);
    setUserId(adminId);
  });

  it('[AQP-113 AC-5 QLT-05] POST, PATCH and DELETE answer 500 with the generic words; no row, value or entry changes; after the read works again a retry succeeds (it does not meet its own first attempt)', async () => {
    const id = idOf(await create('Qa9-Read-Rate'));
    const count = await entryCount(db);
    world.service = db.buildMastersService({ readConfiguration: () => Promise.reject(new Error('the configuration store is down')) });
    const answers = [await create('Qa9-Never-Written'), await call('PATCH', id, { defaultValue: '5.00' }), await call('DELETE', id), await call('GET', null)];
    expect(answers.map((answer) => answer.status)).toEqual([500, 500, 500, 500]);
    for (const answer of answers) expect(answer.text).not.toContain('store is down');
    expect(await names()).not.toContain('Qa9-Never-Written');
    expect((await rowOf(id))?.default_value).toBe('1.3700');
    expect(await entryCount(db)).toBe(count);
    world.service = serviceOverStoredVersions();
    expect((await create('Qa9-Never-Written')).status).toBe(201);
  });
});
