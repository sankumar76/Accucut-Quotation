import { describe, expect, it, vi } from 'vitest';

import { StepUpFailed, StepUpLocked } from '@/lib/errors';
import { createConfigEditService, type ConfigEditCaller, type ConfigEditDependencies } from '@/server/services/config-edit-service';
import { createAuditService } from '@/server/services/audit-service';
import { createConfigVersionCache } from '@/server/services/config-service';
import type { ConfigRepository, ConfigVersionRecord } from '@/server/repositories/config-repository';

import { createFakeAuditWorld } from '../../support/fake-audit';
import { defined } from '../../support/defined';
import { SEED_PROCESS_ITEMS, seedConfig, seedFieldAt } from '../../support/seed-config';

/**
 * STORY-08.02 AC-2, AC-4, AC-5, AC-6, AC-7 and AC-9 at the rules, with no database: the order of the save's checks, what each refusal costs (nothing is written, the password is not asked for a formula that
 * fails), the decision on "edit to its own text", the stale base version, and that the password reaches `verifyStepUp` and nowhere else. The real table, the transaction and the real throttle are
 * `tests/integration/config/save-formula.test.ts`. Every name, figure and password is invented.
 */

const ADMIN: ConfigEditCaller = { user: { id: '00000000-0000-4000-8000-0000000000a1', name: 'Invented Admin', role: 'ADMIN' }, requestId: 'req-0000aaaa' };
const LEAD: ConfigEditCaller = { user: { id: '00000000-0000-4000-8000-0000000000b1', name: 'Invented Lead', role: 'LEAD' }, requestId: 'req-0000bbbb' };
const ENGINEER: ConfigEditCaller = { user: { id: '00000000-0000-4000-8000-0000000000c1', name: 'Invented Engineer', role: 'ENGINEER' }, requestId: 'req-0000cccc' };
const PASSWORD = 'Invented-Secret-1!';
const AL = seedFieldAt('AL');

function record(number: number, snapshot: unknown): ConfigVersionRecord {
  return { id: `00000000-0000-4000-8000-0ccc000000${String(number).padStart(2, '0')}`, number, snapshot, createdBy: null, reason: 'Invented', createdAt: new Date('2026-11-05T09:00:00.000Z') };
}

interface World {
  readonly service: ReturnType<typeof createConfigEditService>;
  readonly versions: ConfigVersionRecord[];
  readonly inserts: Array<{ baseNumber: number; snapshot: unknown; reason: string; createdBy: string }>;
  readonly verifyStepUp: ReturnType<typeof vi.fn>;
  readonly audit: ReturnType<typeof createFakeAuditWorld>;
}

function world(over: Partial<ConfigEditDependencies> = {}, versions: ConfigVersionRecord[] = [record(1, seedConfig)], beforeInsert?: (versions: ConfigVersionRecord[]) => void): World {
  const inserts: World['inserts'] = [];
  const configurations: ConfigRepository = {
    insertSeedVersionIfNone: () => Promise.resolve(false),
    insertVersionAfter(version) {
      beforeInsert?.(versions);
      inserts.push({ baseNumber: version.baseNumber, snapshot: version.snapshot, reason: version.reason, createdBy: version.createdBy });
      const latest = Math.max(...versions.map((each) => each.number));
      if (latest !== version.baseNumber) return Promise.resolve(null);
      const stored = record(latest + 1, version.snapshot);
      versions.push(stored);
      return Promise.resolve({ id: stored.id, number: stored.number });
    },
    findLatestRef() {
      const latest = versions.reduce((best, each) => (each.number > best.number ? each : best));
      return Promise.resolve({ id: latest.id, number: latest.number });
    },
    findById: (id) => Promise.resolve(versions.find((each) => each.id === id) ?? null),
    readVersionUse: () => Promise.resolve({ savedByName: null, estimatesInUse: 0 }),
  };
  const auditWorld = createFakeAuditWorld();
  const verifyStepUp = vi.fn<(caller: unknown, password: string) => Promise<void>>().mockResolvedValue(undefined);
  const service = createConfigEditService({
    configurations,
    masters: { listProcessItems: () => Promise.resolve(SEED_PROCESS_ITEMS.map((item) => ({ ...item, defaultValue: '0.00' }))) },
    calculations: { findLatestCalculation: () => Promise.resolve(null), findCalculation: () => Promise.resolve(null) },
    stepUp: { verifyStepUp },
    transactions: auditWorld.transactions,
    audit: createAuditService({ audit: auditWorld.audit }),
    cache: createConfigVersionCache(),
    ...over,
  });
  return { service, versions, inserts, verifyStepUp, audit: auditWorld };
}

const save = (w: World, text: string, baseVersion = 1, fieldId = AL.id, caller = ADMIN) => w.service.saveFormula(caller, fieldId, { text, password: PASSWORD, baseVersion });
const rejection = async (promise: Promise<unknown>): Promise<Error & { code?: string; httpStatus?: number; fields?: Array<{ field: string; message: string }>; currentVersion?: number }> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof Error) return error;
  }
  throw new Error('Expected a refusal.');
};

describe('AC-7: the Admin alone, checked again before anything is read', () => {
  it.each([
    ['a Lead', LEAD],
    ['an Engineer', ENGINEER],
  ])('refuses %s with 403 on every method and reads and writes nothing', async (_who, caller) => {
    const w = world();
    for (const call of [
      () => w.service.checkFormula(caller, { fieldId: AL.id, text: 'P * 2' }),
      () => w.service.listSampleRows(caller),
      () => save(w, 'P * 2', 1, AL.id, caller),
    ]) {
      const error = await rejection(call());
      expect(error).toMatchObject({ httpStatus: 403 });
    }
    expect(w.verifyStepUp).not.toHaveBeenCalled();
    expect(w.inserts).toEqual([]);
  });
});

describe('AC-2: the server checks again on save, so a client that skipped the live check still gets the 422', () => {
  it.each([
    ['an unknown name', 'P * Cuting-Rate-per-Sec', '"Cuting-Rate-per-Sec" is not a column letter, rate name or function. Check the spelling, or add the rate in the Process master first.'],
    ['a syntax error', 'P * (Cutting-Rate-per-Sec + )', 'The formula ends too soon. A number or name is missing after "+" (position 29).'],
    ['a loop', 'P * Cutting-Rate-per-Sec + AY', 'This formula would make AL depend on itself. The loop is AL → AY → AL. Remove one of these references.'],
  ])('refuses %s with 422 under text, asks for no password and stores nothing', async (_what, text, message) => {
    const w = world();
    const error = await rejection(save(w, text));
    expect(error).toMatchObject({ httpStatus: 422, fields: [{ field: 'text', message }] });
    expect(w.verifyStepUp).not.toHaveBeenCalled();
    expect(w.inserts).toEqual([]);
    expect(w.audit.audit.committed).toEqual([]);
  });

  it('gives the live check the same refusal, and the valid answer when it passes', async () => {
    const w = world();
    expect(await rejection(w.service.checkFormula(ADMIN, { fieldId: AL.id, text: 'P * Cuting-Rate-per-Sec' }))).toMatchObject({ httpStatus: 422, fields: [{ field: 'text' }] });
    const ok = await w.service.checkFormula(ADMIN, { fieldId: AL.id, text: 'P * Cutting-Rate-per-Sec' });
    expect(ok).toEqual({
      valid: true,
      message: 'The formula is valid. It uses P (Cutting Time) and the rate Cutting-Rate-per-Sec. Column AL feeds AY.',
      uses: [
        { kind: 'field', name: 'P (Cutting Time)' },
        { kind: 'rate', name: 'Cutting-Rate-per-Sec' },
      ],
      feeds: [{ letter: 'AY', label: 'Total Process Cost' }],
      preview: null,
    });
  });
});

describe('AC-6: a field with no formula is a 409 system field, an unknown one a 404', () => {
  it.each(['A', 'F', 'I', 'BO'])('answers 409 SYSTEM_FIELD for a save and a check on %s, and writes nothing', async (letter) => {
    const w = world();
    const field = seedFieldAt(letter);
    expect(await rejection(save(w, 'P * 2', 1, field.id))).toMatchObject({ httpStatus: 409, code: 'SYSTEM_FIELD' });
    expect(await rejection(w.service.checkFormula(ADMIN, { fieldId: field.id, text: 'P * 2' }))).toMatchObject({ httpStatus: 409, code: 'SYSTEM_FIELD' });
    expect(w.verifyStepUp).not.toHaveBeenCalled();
    expect(w.inserts).toEqual([]);
  });

  it('answers 404 for an ID that is no field, and for text that is no ID', async () => {
    const w = world();
    expect(await rejection(save(w, 'P * 2', 1, '00000000-0000-4000-8000-00000000dead'))).toMatchObject({ httpStatus: 404 });
    expect(await rejection(save(w, 'P * 2', 1, 'not-an-id'))).toMatchObject({ httpStatus: 404 });
  });

  it('lets BL, SUM(BG), be changed like any other formula', async () => {
    const w = world();
    const result = await save(w, 'SUM(BG) * 1', 1, seedFieldAt('BL').id);
    expect(result).toMatchObject({ version: 2, changed: true });
  });
});

describe('AC-9: two saves from the same base version, the second is a 409 with the newer number', () => {
  it('refuses a base that is no longer the latest, before the formula is read or the password asked for', async () => {
    const w = world({}, [record(1, seedConfig), record(2, seedConfig)]);
    const error = await rejection(save(w, 'P * 2', 1));
    expect(error).toMatchObject({ httpStatus: 409, code: 'CONFIG_VERSION_CHANGED', currentVersion: 2 });
    expect(error.message).toContain('configuration version 2');
    expect(w.verifyStepUp).not.toHaveBeenCalled();
    expect(w.inserts).toEqual([]);
  });

  it('two saves started at once from version 1: one is stored as version 2, the other is the 409 and nothing is overwritten', async () => {
    const w = world();
    const [first, second] = await Promise.allSettled([save(w, 'P * 2'), save(w, 'P * 3')]);
    const fulfilled = [first, second].filter((outcome) => outcome.status === 'fulfilled');
    const rejected = [first, second].filter((outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toMatchObject({ httpStatus: 409, code: 'CONFIG_VERSION_CHANGED', currentVersion: 2 });
    expect(w.versions.map((version) => version.number)).toEqual([1, 2]);
    expect(w.audit.audit.committed).toHaveLength(1);
  });
});

describe('the decision on "edit to its own text"', () => {
  it('writes nothing, makes no version, records no event and does not ask for the password when the formula is the saved one', async () => {
    const w = world();
    const same = await save(w, 'P * Cutting-Rate-per-Sec');
    expect(same).toEqual({ version: 1, changed: false, message: 'This is already the saved formula, so no new version was made.' });
    expect(w.verifyStepUp).not.toHaveBeenCalled();
    expect(w.inserts).toEqual([]);
    expect(w.audit.audit.committed).toEqual([]);
  });

  it('treats a different spelling of the same names as a change, because the stored text differs (spaces are part of it)', async () => {
    const w = world();
    expect(await save(w, 'P*Cutting-Rate-per-Sec')).toMatchObject({ version: 2, changed: true });
  });
});

describe('AC-4: the password, on its own check, after every other refusal and before any write', () => {
  it('passes the signed-in person and the password to verifyStepUp once, and stores nothing when it throws StepUpFailed', async () => {
    const verifyStepUp = vi.fn().mockRejectedValue(new StepUpFailed('That password is not correct.'));
    const w = world({ stepUp: { verifyStepUp } });
    const error = await rejection(save(w, 'P * 2'));
    expect(error).toBeInstanceOf(StepUpFailed);
    expect(verifyStepUp).toHaveBeenCalledTimes(1);
    expect(verifyStepUp).toHaveBeenCalledWith(ADMIN, PASSWORD);
    expect(w.inserts).toEqual([]);
    expect(w.audit.audit.committed).toEqual([]);
  });

  it('lets a blocked step-up through as it is (429), and stores nothing', async () => {
    const w = world({ stepUp: { verifyStepUp: vi.fn().mockRejectedValue(new StepUpLocked('Too many wrong passwords. Try again in 15 minutes.')) } });
    expect(await rejection(save(w, 'P * 2'))).toBeInstanceOf(StepUpLocked);
    expect(w.inserts).toEqual([]);
  });

  it('never puts the password in the version, the audit entry, the answer or an error', async () => {
    const w = world();
    const result = await save(w, 'P * 2');
    const everything = JSON.stringify({ result, inserts: w.inserts, audit: w.audit.audit.appended, committed: w.audit.audit.committed });
    expect(everything).not.toContain(PASSWORD);
    const failing = world({ stepUp: { verifyStepUp: vi.fn().mockRejectedValue(new StepUpFailed('That password is not correct.')) } });
    const error = await rejection(save(failing, 'P * 2'));
    expect(JSON.stringify({ message: error.message, stack: error.stack })).not.toContain(PASSWORD);
  });
});

describe('AC-5: one new version and one audit entry, with the old and the new text', () => {
  it('stores the next version with the whole edited document, who made it and a reason that holds no formula', async () => {
    const w = world();
    const result = await save(w, 'P * 2');
    expect(result).toEqual({ version: 2, changed: true, message: 'Formula saved as configuration version 2.' });
    const [stored] = w.inserts;
    expect(stored).toMatchObject({ baseNumber: 1, createdBy: ADMIN.user.id, reason: 'Formula of AL Cutting Cost changed' });
    const document = stored?.snapshot as typeof seedConfig;
    const changed = document.fields.filter((field, index) => JSON.stringify(field) !== JSON.stringify(seedConfig.fields[index]));
    expect(changed.map((field) => field.id)).toEqual([AL.id]);
  });

  it('records config.formula_changed with the old and the new text in display form and the new number, in the same transaction', async () => {
    const w = world();
    await save(w, 'P * 2');
    const [entry] = w.audit.audit.committed;
    expect(entry).toMatchObject({
      event: 'config.formula_changed',
      objectType: 'field',
      objectId: AL.id,
      objectLabel: 'AL Cutting Cost',
      actorId: ADMIN.user.id,
      before: { formula: 'P * Cutting-Rate-per-Sec' },
      after: { formula: 'P * 2', version: 2 },
    });
    expect(w.audit.audit.appended).toHaveLength(1);
    expect(defined(w.audit.audit.appended[0]).objectLabel).toBe('AL Cutting Cost');
  });

  it('refuses a stale insert inside the transaction (another save slipped in after the check) with the 409 and no audit entry', async () => {
    // Another save commits version 2 after this one read version 1 and checked its formula, and before its insert: the repository stores nothing and answers null.
    const w = world({}, [record(1, seedConfig)], (versions) => {
      if (versions.length === 1) versions.push(record(2, seedConfig));
    });
    const error = await rejection(save(w, 'P * 2', 1));
    expect(error).toMatchObject({ httpStatus: 409, code: 'CONFIG_VERSION_CHANGED', currentVersion: 2 });
    expect(w.versions.map((version) => version.number)).toEqual([1, 2]);
    expect(w.audit.audit.committed).toEqual([]);
  });
});

describe('AC-1 and AC-3: the preview and the sample rows', () => {
  it('says there is no calculated estimate to try the formula on, and still checks the formula', async () => {
    const w = world();
    expect(await w.service.listSampleRows(ADMIN)).toEqual({
      estimate: null,
      rows: [],
      operandNames: ['Material-Price-per-kg', 'Material-Specific-Gravity', 'Material-Scrap-Rate', 'ExchangeRate-USD', 'ExchangeRate-EUR'],
    });
    expect((await w.service.checkFormula(ADMIN, { fieldId: AL.id, text: 'P * 2' })).preview).toBeNull();
  });
});
