import { describe, expect, it } from 'vitest';

import { ConflictError, FieldValidationError, ForbiddenError, NotFoundError } from '@/lib/errors';
import { CUSTOMER_DELETED_CODE, MATERIAL_DELETED_CODE } from '@/lib/estimate/calculate-words';
import { TRANSITION_REFUSALS, type EstimateStatus } from '@/lib/estimate/state-machine';
import { checkUnlockReason, UNLOCK_CUSTOMER_DELETED_MESSAGE, UNLOCK_MATERIAL_DELETED_MESSAGE, UNLOCK_REASON_MAX, UNLOCK_REASON_REQUIRED_MESSAGE, UNLOCK_REASON_TOO_LONG_MESSAGE } from '@/lib/estimate/unlock-words';
import { TEXT_CHARACTERS_MESSAGE } from '@/lib/estimate/validation';
import { assertMayUnlock, createUnlockService, type UnlockDependencies } from '@/server/services/unlock-service';

import { FIXTURE_CUSTOMER_ID, FIXTURE_MATERIAL_ID, mastersNow, storedSnapshot } from '../../support/rate-change-fixture';
import { seedConfig } from '../../support/seed-config';

/**
 * STORY-06.08 AC-2, AC-4 to AC-6, AC-8 and AC-10 (FR-063; NFR-001, NFR-007; architecture sections 4.8 and 6 "Unlock"), in the unit's own terms and with no storage: the order of the checks, what is written and in what
 * order, that a refusal writes nothing (an audit entry included), and what the preview compares. The real row lock, the two orders against a delete and the grants are `tests/integration/approval/unlock.test.ts`'s.
 * Every ID, name and number is invented.
 */

const ESTIMATE_ID = '00000000-0000-4000-8000-0000000e5701';
// The masters and the snapshot are the fixture the Lead's rate notice is tested with as well (STORY-06.11 AC-8): one set of changes, the same counts from both readers.
const CUSTOMER_ID = FIXTURE_CUSTOMER_ID;
const MATERIAL_ID = FIXTURE_MATERIAL_ID;
const APPROVAL_ID = '00000000-0000-4000-8000-0000000a9901';
const CALCULATION_ID = '00000000-0000-4000-8000-0000000ca1c1';
const UNLOCKED_AT = new Date('2026-11-16T06:30:00.000Z');
const lead = { id: 'lead-1', role: 'LEAD' } as const;
const admin = { id: 'admin-1', role: 'ADMIN' } as const;
const engineer = { id: 'engineer-1', role: 'ENGINEER' } as const;
const audit = { actorId: lead.id, actorLabel: 'Invented Lead', requestId: 'request-1' };
const REASON = 'The customer asked for a thicker plate.';
const tx = { kind: 'database-transaction' } as const;

interface Options {
  readonly status?: EstimateStatus;
  readonly customerId?: string | null;
  readonly customerDeleted?: boolean;
  readonly materials?: ReadonlyArray<{ id: string; deleted: boolean }>;
  readonly live?: boolean;
  readonly markUnlockedFails?: boolean;
  readonly auditFails?: boolean;
  /** The masters now, for the preview. */
  readonly now?: { readonly rate?: string; readonly price?: string; readonly usd?: string };
  readonly currentVersion?: number;
}

function build(options: Options = {}) {
  const writes: string[] = [];
  const audited: unknown[] = [];
  const marked: unknown[] = [];
  let status: EstimateStatus = options.status ?? 'APPROVED';
  const customerId = options.customerId === undefined ? CUSTOMER_ID : options.customerId;
  const snapshot = storedSnapshot();
  const { masters } = mastersNow({ ...options.now, customerDeleted: options.customerDeleted === true });
  const dependencies: UnlockDependencies = {
    estimates: {
      lockEstimate: (id) => {
        writes.push('lock');
        return Promise.resolve(id === ESTIMATE_ID ? { id, engineerId: 'engineer-1', status, customerId, inputsRevision: 4, taskCode: 'Q-2026-0001' } : null);
      },
      findEstimateAccess: (id) => Promise.resolve(id === ESTIMATE_ID ? { id, engineerId: 'engineer-1', status } : null),
      findActiveCustomer: () => {
        writes.push('customer');
        return Promise.resolve(options.customerDeleted === true ? null : { id: CUSTOMER_ID, name: 'Invented Customer', shortName: 'INV' });
      },
      lockMaterialsInUse: () => {
        writes.push('materials');
        return Promise.resolve(options.materials ?? [{ id: MATERIAL_ID, deleted: false }]);
      },
    },
    approvals: {
      findLiveApproval: () => Promise.resolve(options.live === false ? null : { id: APPROVAL_ID, calculationId: CALCULATION_ID, approvedPrice: '12600.00', engineerName: 'Invented Priya' }),
      markUnlocked: (unlock) => {
        writes.push('mark');
        marked.push(unlock);
        return Promise.resolve(options.markUnlockedFails === true ? null : UNLOCKED_AT);
      },
    },
    calculations: { findMasterSnapshot: () => Promise.resolve({ configVersionId: 'version-7', masterSnapshot: snapshot }) },
    masters,
    configuration: {
      current: () => Promise.resolve({ id: 'version-9', number: options.currentVersion ?? 9, document: seedConfig, reason: 'Invented', createdBy: null, createdAt: '2026-11-01T00:00:00.000Z' }),
      byId: () => Promise.resolve({ id: 'version-7', number: 7, document: seedConfig, reason: 'Invented', createdBy: null, createdAt: '2026-10-01T00:00:00.000Z' }),
    },
    transactions: { run: (work) => work(tx) },
    workflow: {
      transition: () => {
        writes.push('transition');
        status = 'DRAFT';
        return Promise.resolve({ id: ESTIMATE_ID, from: 'APPROVED', to: 'DRAFT' });
      },
      audit: {
        record: (_tx, entry) => {
          writes.push('audit');
          if (options.auditFails === true) return Promise.reject(new Error('The audit entry could not be written.'));
          audited.push(entry);
          return Promise.resolve();
        },
        recordMany: () => Promise.reject(new Error('Invented: the batch write is not used by this test.')),
        list: () => Promise.reject(new Error('Not used.')),
      },
    },
  };
  return { service: createUnlockService(dependencies), writes, audited, marked, statusNow: () => status };
}

describe('the reason is judged by one rule (AC-4)', () => {
  it.each([
    ['', UNLOCK_REASON_REQUIRED_MESSAGE],
    ['   ', UNLOCK_REASON_REQUIRED_MESSAGE],
    ['\n\t  ', UNLOCK_REASON_REQUIRED_MESSAGE],
    ['x'.repeat(UNLOCK_REASON_MAX + 1), UNLOCK_REASON_TOO_LONG_MESSAGE],
  ])('refuses %j', (text, message) => {
    expect(checkUnlockReason(text)).toEqual({ ok: false, message });
  });

  it('keeps the trimmed text, and accepts exactly 500 characters', () => {
    expect(checkUnlockReason(`  ${REASON}\n`)).toEqual({ ok: true, reason: REASON });
    expect(checkUnlockReason('x'.repeat(UNLOCK_REASON_MAX))).toEqual({ ok: true, reason: 'x'.repeat(UNLOCK_REASON_MAX) });
  });

  it('counts characters as the database does, so 500 emoji are not judged longer than 500', () => {
    expect(checkUnlockReason('😀'.repeat(UNLOCK_REASON_MAX)).ok).toBe(true);
    expect(checkUnlockReason('😀'.repeat(UNLOCK_REASON_MAX + 1)).ok).toBe(false);
  });

  it('keeps the line breaks of a reason over several lines (a carriage return is folded into one line feed)', () => {
    expect(checkUnlockReason('First.\r\nSecond.')).toEqual({ ok: true, reason: 'First.\nSecond.' });
  });

  // DL-219: typed text refuses every control, format and separator character and a lone surrogate, as the reason of an approval does. Such a character would be invisible in the audit log, and a NUL or a
  // lone surrogate cannot be stored by PostgreSQL at all (a 500 and not a 422).
  it.each([
    ['a zero-width joiner', 'Round\u200Ded'],
    ['a zero-width space', 'Round\u200Bed'],
    ['a byte order mark', 'Round\uFEFFed'],
    ['a bidirectional override', 'Round\u202Eed'],
    ['a NUL', 'Round\u0000ed'],
    ['a lone surrogate', 'Round\uD800ed'],
  ])('refuses %s with the shared sentence', (_name, text) => {
    expect(checkUnlockReason(text)).toEqual({ ok: false, message: TEXT_CHARACTERS_MESSAGE });
  });

  it('says it in the words the screen shows', () => {
    expect(UNLOCK_REASON_REQUIRED_MESSAGE).toBe('Enter a reason.');
    expect(UNLOCK_REASON_TOO_LONG_MESSAGE).toBe('Use 500 characters or fewer.');
  });
});

describe('AC-6: the role is checked first and alone', () => {
  it('an Engineer is refused 403 by the role check, and a Lead and an Admin pass it', () => {
    expect(() => assertMayUnlock(engineer)).toThrow(ForbiddenError);
    expect(() => assertMayUnlock(lead)).not.toThrow();
    expect(() => assertMayUnlock(admin)).not.toThrow();
  });

  it('the service rejects with the 403 as a promise and touches nothing, even with an empty reason and an unknown estimate', async () => {
    const { service, writes } = build();
    await expect(service.unlock(engineer, 'no-such-estimate', { reason: '', audit })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.preview(engineer, ESTIMATE_ID)).rejects.toBeInstanceOf(ForbiddenError);
    expect(writes).toEqual([]);
  });
});

describe('AC-4: an empty, white-space or over-long reason is a 422 under `reason`, and nothing is read or written', () => {
  it.each(['', '   ', 'x'.repeat(UNLOCK_REASON_MAX + 1)])('%j', async (reason) => {
    const { service, writes } = build();
    const error: unknown = await service.unlock(lead, ESTIMATE_ID, { reason, audit }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(FieldValidationError);
    expect((error as FieldValidationError).fields).toEqual([{ field: 'reason', message: reason.length > UNLOCK_REASON_MAX ? UNLOCK_REASON_TOO_LONG_MESSAGE : UNLOCK_REASON_REQUIRED_MESSAGE }]);
    expect(writes).toEqual([]);
  });
});

describe('AC-2: a good unlock writes the status, the unlock and the audit entry, in that order, in one transaction', () => {
  it.each([lead, admin])('$role: the status moves to DRAFT, the unlock is stored with the trimmed reason, and the entry holds the price before and the reason', async (viewer) => {
    const { service, writes, audited, marked, statusNow } = build();
    await expect(service.unlock(viewer, ESTIMATE_ID, { reason: `  ${REASON} `, audit })).resolves.toEqual({ status: 'DRAFT', unlockedAt: '2026-11-16T06:30:00.000Z' });
    // The lock, then the customer and the materials (AC-10), then the writes.
    expect(writes).toEqual(['lock', 'customer', 'materials', 'transition', 'mark', 'audit']);
    expect(statusNow()).toBe('DRAFT');
    expect(marked).toEqual([{ approvalId: APPROVAL_ID, unlockedById: viewer.id, reason: REASON }]);
    expect(audited).toEqual([
      { event: 'approval.unlocked', ...audit, object: { id: ESTIMATE_ID, label: 'Q-2026-0001' }, before: { approvedPrice: '12600.00' }, after: { reason: REASON } },
    ]);
  });

  it('an audit entry that cannot be written fails the unlock (the transaction takes the rest back)', async () => {
    const { service } = build({ auditFails: true });
    await expect(service.unlock(lead, ESTIMATE_ID, { reason: REASON, audit })).rejects.toThrow('audit entry');
  });
});

describe('AC-5: a status that is not APPROVED, and an estimate that is not there', () => {
  it('an unknown estimate is a 404 before the status is looked at', async () => {
    const { service, writes } = build();
    await expect(service.unlock(lead, '00000000-0000-4000-8000-00000000dead', { reason: REASON, audit })).rejects.toBeInstanceOf(NotFoundError);
    expect(writes).toEqual(['lock']);
  });

  it.each(['DRAFT', 'SUBMITTED'] as const)('%s is the state machine\'s 409, the code and sentence of "not approved", and nothing is written', async (status) => {
    const { service, writes, audited } = build({ status });
    const error: unknown = await service.unlock(lead, ESTIMATE_ID, { reason: REASON, audit }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ httpStatus: 409, code: TRANSITION_REFUSALS.NOT_APPROVED.code, message: TRANSITION_REFUSALS.NOT_APPROVED.message });
    expect(writes).toEqual(['lock']);
    expect(audited).toEqual([]);
  });

  it('a second unlock, after the first, is that same 409 and stores nothing more', async () => {
    const { service, marked, audited } = build();
    await service.unlock(lead, ESTIMATE_ID, { reason: REASON, audit });
    await expect(service.unlock(lead, ESTIMATE_ID, { reason: REASON, audit })).rejects.toMatchObject({ httpStatus: 409, code: TRANSITION_REFUSALS.NOT_APPROVED.code });
    expect(marked).toHaveLength(1);
    expect(audited).toHaveLength(1);
  });

  it('an approved estimate with no live approval is a fault in the data (a plain error), and nothing is written', async () => {
    const { service, writes } = build({ live: false });
    await expect(service.unlock(lead, ESTIMATE_ID, { reason: REASON, audit })).rejects.toThrow('no live approval');
    expect(writes).toEqual(['lock', 'customer', 'materials']);
  });

  it('an unlock that finds the approval no longer live is a fault, never an audit entry', async () => {
    const { service, audited } = build({ markUnlockedFails: true });
    await expect(service.unlock(lead, ESTIMATE_ID, { reason: REASON, audit })).rejects.toThrow('no longer live');
    expect(audited).toEqual([]);
  });
});

describe('AC-10: a customer or a material deleted after the approval refuses the unlock, in the unlock\'s words, and nothing is written', () => {
  it('the customer: 409 CUSTOMER_DELETED, the status stays APPROVED, no unlock, no audit entry', async () => {
    const { service, writes, audited, statusNow } = build({ customerDeleted: true });
    const error: unknown = await service.unlock(lead, ESTIMATE_ID, { reason: REASON, audit }).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ httpStatus: 409, code: CUSTOMER_DELETED_CODE, message: UNLOCK_CUSTOMER_DELETED_MESSAGE });
    expect(writes).toEqual(['lock', 'customer']);
    expect(statusNow()).toBe('APPROVED');
    expect(audited).toEqual([]);
  });

  it('a material a part names, listed after others in ascending order: 409 MATERIAL_DELETED', async () => {
    const { service, writes, audited } = build({
      materials: [
        { id: MATERIAL_ID, deleted: false },
        { id: '00000000-0000-4000-8000-0000000a7e02', deleted: true },
      ],
    });
    const error: unknown = await service.unlock(lead, ESTIMATE_ID, { reason: REASON, audit }).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ httpStatus: 409, code: MATERIAL_DELETED_CODE, message: UNLOCK_MATERIAL_DELETED_MESSAGE });
    expect(writes).toEqual(['lock', 'customer', 'materials']);
    expect(audited).toEqual([]);
  });

  it('an estimate with no customer is not affected: the customer is not looked up, and the unlock goes ahead', async () => {
    const { service, writes } = build({ customerId: null });
    await service.unlock(lead, ESTIMATE_ID, { reason: REASON, audit });
    expect(writes).toEqual(['lock', 'materials', 'transition', 'mark', 'audit']);
  });

  it('an estimate whose parts name no material goes ahead', async () => {
    const { service, writes } = build({ materials: [] });
    await service.unlock(lead, ESTIMATE_ID, { reason: REASON, audit });
    expect(writes).toContain('mark');
  });

  it('the words: the sentences of ux-spec v0.30, with no price and no file in them', () => {
    expect(UNLOCK_CUSTOMER_DELETED_MESSAGE).toBe('The customer chosen for this estimate was deleted, so the estimate cannot be unlocked. The approval was not changed.');
    expect(UNLOCK_MATERIAL_DELETED_MESSAGE).toBe('A material chosen for a part of this estimate was deleted, so the estimate cannot be unlocked. The approval was not changed.');
    expect(UNLOCK_CUSTOMER_DELETED_MESSAGE).not.toContain('Excel');
    expect(UNLOCK_MATERIAL_DELETED_MESSAGE).not.toContain('Excel');
  });
});

describe('AC-1, AC-8: the preview compares the approved calculation with the masters now, as counts', () => {
  it('nothing changed: version 7 to 9 is still told (the configuration moved), and every count is 0', async () => {
    const { service } = build();
    await expect(service.preview(lead, ESTIMATE_ID)).resolves.toEqual({ engineerName: 'Invented Priya', configuration: { approved: 7, current: 9 }, changed: { processRates: 0, materialPrices: 0, exchangeRates: 0 } });
  });

  it('a process rate, a material price and an exchange rate changed: one of each', async () => {
    const { service } = build({ now: { rate: '12.00', price: '85', usd: '84' } });
    await expect(service.preview(lead, ESTIMATE_ID)).resolves.toMatchObject({ changed: { processRates: 1, materialPrices: 1, exchangeRates: 1 } });
  });

  it('answers two numbers and three counts and nothing else', async () => {
    const { service } = build({ now: { rate: '12.00' } });
    const preview = await service.preview(admin, ESTIMATE_ID);
    expect(Object.keys(preview).sort()).toEqual(['changed', 'configuration', 'engineerName']);
    expect(Object.keys(preview.configuration).sort()).toEqual(['approved', 'current']);
    expect(Object.keys(preview.changed).sort()).toEqual(['exchangeRates', 'materialPrices', 'processRates']);
  });

  it('is a read: it takes no lock and writes nothing', async () => {
    const { service, writes } = build({ now: { rate: '12.00' } });
    await service.preview(lead, ESTIMATE_ID);
    expect(writes).toEqual([]);
  });

  it('an unknown estimate is a 404, a Draft is the machine\'s 409, and a deleted customer is the unlock\'s 409 in its words', async () => {
    await expect(build().service.preview(lead, '00000000-0000-4000-8000-00000000dead')).rejects.toBeInstanceOf(NotFoundError);
    await expect(build({ status: 'DRAFT' }).service.preview(lead, ESTIMATE_ID)).rejects.toMatchObject({ httpStatus: 409, code: TRANSITION_REFUSALS.NOT_APPROVED.code });
    await expect(build({ customerDeleted: true }).service.preview(lead, ESTIMATE_ID)).rejects.toMatchObject({ httpStatus: 409, code: CUSTOMER_DELETED_CODE, message: UNLOCK_CUSTOMER_DELETED_MESSAGE });
  });

  it('an approved estimate with no live approval is a fault in the data', async () => {
    await expect(build({ live: false }).service.preview(lead, ESTIMATE_ID)).rejects.toThrow('no live approval');
  });
});
