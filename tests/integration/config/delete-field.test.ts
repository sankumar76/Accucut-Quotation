import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { fieldUses } from '@/lib/config/field-delete';
import { StepUpFailed, StepUpLocked } from '@/lib/errors';
import { fieldLetter, findFieldByKey, referenceContext } from '@/lib/fields/registry';
import { parseConfigDocument } from '@/lib/fields/schema';
import { toDisplayForm } from '@/lib/formula';
import { systemClock } from '@/lib/time';
import { exportColumnsOf } from '@/server/export/export-columns';
import { createConfigRepository } from '@/server/repositories/config-repository';
import { createAuditService } from '@/server/services/audit-service';
import { createConfigEditService, type ConfigEditCaller } from '@/server/services/config-edit-service';
import { createConfigStructureService, type ConfigStructureService } from '@/server/services/config-structure-service';
import { createConfigVersionCache } from '@/server/services/config-service';
import type { EstimateViewer } from '@/server/services/estimate-service';
import { createStepUpService } from '@/server/services/step-up-service';

import { KEY_SECRET } from '../../support/audit-database';
import { createTestHasher, insertUser } from '../../support/builders/user';
import { type CalculationDatabase, openCalculationDatabase } from '../../support/calculation-database';
import { defined } from '../../support/defined';
import { inputAfterAx } from '../../support/insert-specs';
import { SEED_PROCESS_ITEMS, seedConfig, seedFieldAt } from '../../support/seed-config';

/**
 * STORY-08.04 against real PostgreSQL in a throwaway database, as the runtime role, with the real step-up service and its real throttle: a blocked field never asks for a password (AC-2), the protected fields are
 * refused (AC-5), a wrong password stores nothing and writes no entry and five wrong ones lock the step-up (AC-4), one new immutable version and one audit entry in one transaction (AC-3, AC-8), the re-lettering
 * of what stays (AC-6), what a delete does to the estimates (AC-7: a calculation made before keeps its own version, letters and values; a Draft that holds a value in the deleted input still calculates; a
 * calculation made after has no such column in its export), two deletes racing, a delete racing a formula save, and a failing audit entry that takes the version back. The audit event `config.field_deleted` is
 * written and read back here, as the registry requires of a wired event. The pure property tests are `tests/unit/config/field-delete.test.ts`. Every name and password is invented.
 */

let db: CalculationDatabase;
let service: ConfigStructureService;
let admin: ConfigEditCaller;
/** An estimate calculated with version 1, before any delete: its record must stay on version 1 for good. */
let earlierEstimate: string;
/** A complete Draft made before any delete that holds a value in Part No., the field the first delete removes. */
let draft: string;

const RIGHT = 'Tn4#vLm8@Qz-right';
const WRONG = 'Not-the-right-1!';
const RATES = SEED_PROCESS_ITEMS.map(({ id, name }) => ({ id, name }));
/** Part No.: an input the portal only tolerates (it names a part), nothing uses it, and it is early in the sheet, so every later column moves. */
const PART_NO = defined(findFieldByKey(seedConfig, 'part-no'));
const configurations = () => createConfigRepository(db.prisma);
const engineer = (): EstimateViewer => ({ id: db.engineerId, role: 'ENGINEER' });

/**
 * A gate that holds each caller at the password step until every party has arrived. The version a delete or a save works from is read before the password step, so once both are at the gate both hold the same base,
 * and a race is a race whatever the machine's speed (without it, a fast first call could finish before the second one read, and then both would rightly succeed).
 */
function gateOf(parties: number): () => Promise<void> {
  let arrived = 0;
  const waiting: Array<() => void> = [];
  return () =>
    new Promise<void>((resolve) => {
      arrived += 1;
      waiting.push(resolve);
      if (arrived >= parties) for (const release of waiting) release();
    });
}

const stepUp = (gate?: () => Promise<void>) => {
  const real = createStepUpService({ users: db.users, throttles: db.throttles, hasher: createTestHasher(), clock: systemClock, keySecret: KEY_SECRET });
  return { verifyStepUp: async (caller: Parameters<typeof real.verifyStepUp>[0], password: string) => (await gate?.(), real.verifyStepUp(caller, password)) };
};

function buildService(over: { audit?: typeof db.audit; gate?: () => Promise<void> } = {}): ConfigStructureService {
  return createConfigStructureService({
    configurations: configurations(),
    masters: db.masterRepository,
    stepUp: stepUp(over.gate),
    transactions: db.transactions,
    audit: over.audit ?? db.audit,
    cache: createConfigVersionCache(),
  });
}

async function versionNumbers(): Promise<number[]> {
  const { rows } = await db.owner.query<{ number: number }>('SELECT number FROM config_versions ORDER BY number');
  return rows.map((row) => row.number);
}

const latestNumber = async (): Promise<number> => defined((await versionNumbers()).at(-1));

async function storedVersion(number: number) {
  const { rows } = await db.owner.query<{ id: string; created_by: string | null; reason: string; snapshot: unknown }>('SELECT id::text, created_by::text, reason, snapshot FROM config_versions WHERE number = $1', [number]);
  const row = defined(rows[0]);
  return { ...row, document: parseConfigDocument(row.snapshot) };
}

const auditEntries = async () => {
  const { rows } = await db.owner.query<{ actor_id: string; object_type: string; object_id: string; object_label: string; before: unknown; after: Record<string, unknown> }>(
    "SELECT actor_id::text, object_type, object_id::text, object_label, before, after FROM audit_log WHERE event = 'config.field_deleted' ORDER BY created_at",
  );
  return rows;
};

/** Inserts a Number input that nothing uses (the seed has hardly one that is free and holds a number), through the insert of STORY-08.03, and answers it as the latest version holds it. */
async function addFreeInput(label: string) {
  const inserted = await service.insertFields(admin, { spec: inputAfterAx({ label, defaultValue: '1' }), baseVersion: await latestNumber() });
  const document = (await storedVersion(inserted.version)).document;
  const field = defined(document.fields.find((candidate) => candidate.label === label));
  expect(fieldUses(document, RATES, field.id)).toEqual([]);
  return field;
}

beforeAll(async () => {
  db = await openCalculationDatabase();
  service = buildService();
  const { id } = await insertUser(db.users, createTestHasher(), { email: 'deleter@example.test', name: 'Invented Deleter', role: 'ADMIN', password: RIGHT });
  admin = { user: { id, name: 'Invented Deleter', role: 'ADMIN' }, requestId: 'req-0000cafe' };
  earlierEstimate = await db.addCompleteEstimate();
  await db.service.calculate(engineer(), earlierEstimate);
  draft = await db.addCompleteEstimate();
  await db.owner.query('UPDATE estimate_nodes SET inputs = inputs || jsonb_build_object($1::text, $2::text) WHERE estimate_id = $3::uuid', [PART_NO.id, 'Invented-PN-0001', draft]);
}, 120_000);

afterAll(async () => {
  await db.close();
});

describe('AC-2 and AC-5: a blocked field and a protected field cost nothing', () => {
  it('refuses a field a formula uses with 409 FIELD_IN_USE and the list, even with a wrong password, which is not counted, and stores nothing', async () => {
    const error = await service.deleteField(admin, seedFieldAt('AL').id, { password: WRONG }).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ httpStatus: 409, code: 'FIELD_IN_USE' });
    expect(error instanceof Error && error.message).toMatch(/^Cannot delete AL Cutting Cost yet\./);
    expect(await versionNumbers()).toEqual([1]);
    expect(await auditEntries()).toEqual([]);
    // The wrong password was never looked at, so it was not counted: the last test of this file needs five more wrong ones before the step-up locks.
  });

  it('refuses each protected field with 409 SYSTEM_FIELD and asks for no password', async () => {
    for (const letter of ['A', 'E', 'F', 'H', 'I', 'BG', 'BH', 'BI', 'BJ', 'BK', 'BL', 'BM', 'BN', 'BO']) {
      await expect(service.deleteField(admin, seedFieldAt(letter).id, { password: WRONG }), letter).rejects.toMatchObject({ httpStatus: 409, code: 'SYSTEM_FIELD' });
    }
    expect(await versionNumbers()).toEqual([1]);
  });

  it('answers the references of a used field with its formulas, and an empty list for one nothing uses', async () => {
    const used = await service.listReferences(admin, seedFieldAt('AL').id);
    expect(used.uses[0]).toMatchObject({ kind: 'formula', letter: 'AY' });
    expect((await service.listReferences(admin, PART_NO.id)).uses).toEqual([]);
  });
});

describe('AC-4: the password step', () => {
  it('refuses a wrong password with 422 STEP_UP_FAILED, stores nothing and writes no audit entry', async () => {
    await expect(service.deleteField(admin, PART_NO.id, { password: WRONG })).rejects.toBeInstanceOf(StepUpFailed);
    expect(await versionNumbers()).toEqual([1]);
    expect(await auditEntries()).toEqual([]);
  });
});

describe('AC-3, AC-6 and AC-8: one new immutable version and one audit entry, together', () => {
  it('stores version 2: the field gone, every later position one lower, every other field with its ID, its formula and its label, and no stored formula rewritten', async () => {
    const result = await service.deleteField(admin, PART_NO.id, { password: RIGHT });
    expect(result).toEqual({ version: 2, message: 'Field deleted. Configuration version 2.' });

    const stored = await storedVersion(2);
    expect(stored.created_by).toBe(admin.user.id);
    expect(stored.reason).toBe(`Deleted B ${PART_NO.label}`);
    expect(stored.document.fields).toHaveLength(seedConfig.fields.length - 1);
    expect(stored.document.fields.map((field) => field.position)).toEqual(stored.document.fields.map((_field, index) => index + 1));
    const kept = seedConfig.fields.filter((field) => field.id !== PART_NO.id);
    expect(stored.document.fields.map((field) => ({ ...field, position: 0 }))).toEqual(kept.map((field) => ({ ...field, position: 0 })));
    expect(stored.document.sections).toEqual(seedConfig.sections);
    expect(stored.document.stages).toEqual(seedConfig.stages);
    // The estimate's own cells moved with their columns: the total (BL) is the letter before BL, found by what it is.
    const total = defined(stored.document.fields.find((field) => field.systemRole === 'total'));
    expect(fieldLetter(total)).toBe('BK');
  });

  it("records 'config.field_deleted' in the same transaction: who, the column as it was, what moved, the version, and no password", async () => {
    const entries = await auditEntries();
    expect(entries).toHaveLength(1);
    const entry = defined(entries[0]);
    expect(entry).toMatchObject({ actor_id: admin.user.id, object_type: 'field', object_id: PART_NO.id, object_label: `B ${PART_NO.label}` });
    expect(entry.before).toEqual({ letter: 'B', label: PART_NO.label, kind: 'input', formula: null });
    expect(entry.after).toEqual({ moved: [{ from: 'C', to: 'BO', by: 1 }], version: 2 });
    expect(JSON.stringify(entry)).not.toContain(RIGHT);
    expect(JSON.stringify(entry)).not.toMatch(/password/i);
  });

  it('refuses a second delete of the same field 404, and makes no version', async () => {
    await expect(service.deleteField(admin, PART_NO.id, { password: RIGHT })).rejects.toMatchObject({ httpStatus: 404 });
    expect(await versionNumbers()).toEqual([1, 2]);
  });
});

describe('AC-7: what a delete does to the estimates', () => {
  it('leaves the calculation made before on version 1, whose letters, cells and values are as they were: the table cannot change it', async () => {
    const { rows } = await db.owner.query<{ number: number }>('SELECT v.number FROM calculations c JOIN config_versions v ON v.id = c.config_version_id WHERE c.estimate_id = $1::uuid', [earlierEstimate]);
    expect(rows).toEqual([{ number: 1 }]);
    const first = await storedVersion(1);
    expect(first.document).toEqual(seedConfig);
    expect(fieldLetter(defined(findFieldByKey(first.document, 'part-no')))).toBe('B');
    expect(exportColumnsOf(first.document).map((column) => column.header)).toContain(PART_NO.label);
  });

  it('calculates a Draft that holds a value in the deleted input: the value is ignored, not an error, and it stays in the part', async () => {
    const answer = await db.service.calculate(engineer(), draft);
    expect(answer.status).toBe('SUBMITTED');
    const stored = await db.owner.query<{ number: number; has: boolean }>(
      'SELECT v.number, r.inputs ? $2 AS has FROM calculations c JOIN config_versions v ON v.id = c.config_version_id JOIN calculation_rows r ON r.calculation_id = c.id WHERE c.estimate_id = $1::uuid',
      [draft, PART_NO.id],
    );
    // Made with the latest version, which has no Part No.; the calculation's own row holds no value for it.
    expect(stored.rows).toEqual([{ number: 2, has: false }]);
    // The part itself still holds what the Engineer typed (it is not deleted from the part).
    const part = await db.owner.query<{ has: boolean }>('SELECT inputs ? $2 AS has FROM estimate_nodes WHERE estimate_id = $1::uuid', [draft, PART_NO.id]);
    expect(part.rows).toEqual([{ has: true }]);
  });

  it('gives a calculation made after the delete a worksheet with no such column, and the product cells one letter lower', async () => {
    const latest = await storedVersion(await latestNumber());
    const headers = exportColumnsOf(latest.document).map((column) => column.header);
    expect(headers).not.toContain(PART_NO.label);
    expect(headers).toHaveLength(seedConfig.fields.length - 1);
  });
});

describe('AC-3: two deletes from the same base, a delete racing a formula save, and an audit entry that cannot be written', () => {
  it('stores one of two deletes at once and answers the other 409 CONFIG_VERSION_CHANGED with the newer number', async () => {
    const first = await addFreeInput('Invented Racer One');
    const second = await addFreeInput('Invented Racer Two');
    const base = await latestNumber();
    const gate = gateOf(2);
    const one = buildService({ gate });
    const other = buildService({ gate });
    const outcomes = await Promise.allSettled([one.deleteField(admin, first.id, { password: RIGHT }), other.deleteField(admin, second.id, { password: RIGHT })]);
    const losers = outcomes.filter((outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected');
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(losers[0]?.reason).toMatchObject({ httpStatus: 409, code: 'CONFIG_VERSION_CHANGED', currentVersion: base + 1 });
    expect(await latestNumber()).toBe(base + 1);
    // Exactly one of the two fields is gone from the new version.
    const stored = (await storedVersion(base + 1)).document;
    expect([first, second].filter((field) => stored.fields.some((candidate) => candidate.id === field.id))).toHaveLength(1);
  });

  it('never leaves a formula that reads a deleted field: a delete and a formula save that makes the field used cannot both win', async () => {
    const target = await addFreeInput('Invented Racer Three');
    const base = await latestNumber();
    const document = (await storedVersion(base)).document;
    const alStored = defined(document.fields.find((field) => field.id === seedFieldAt('AL').id));
    const current = toDisplayForm(alStored.kind === 'output' && alStored.formula !== null ? alStored.formula : '', referenceContext(document, RATES));
    const gate = gateOf(2);
    const deleter = buildService({ gate });
    const editor = createConfigEditService({
      configurations: configurations(),
      masters: db.masterRepository,
      calculations: db.calculations,
      stepUp: stepUp(gate),
      transactions: db.transactions,
      audit: db.audit,
      cache: createConfigVersionCache(),
    });
    const outcomes = await Promise.allSettled([
      deleter.deleteField(admin, target.id, { password: RIGHT }),
      editor.saveFormula(admin, alStored.id, { text: `${current} + ${fieldLetter(target)}`, password: RIGHT, baseVersion: base }),
    ]);
    const losers = outcomes.filter((outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected');
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    // Both held the same base at the password step, so the loser's base is no longer the latest.
    expect(losers[0]?.reason).toMatchObject({ httpStatus: 409, code: 'CONFIG_VERSION_CHANGED' });
    expect(await latestNumber()).toBe(base + 1);
    // Every stored version is a valid registry: a formula that names a field that is gone would not parse (`storedVersion` parses it).
    const latest = (await storedVersion(base + 1)).document;
    const al = defined(latest.fields.find((field) => field.id === alStored.id));
    const reads = al.kind === 'output' && al.formula !== null && al.formula.includes(`{{f:${target.id}}}`);
    expect(latest.fields.some((field) => field.id === target.id)).toBe(reads);
  });

  it('makes no version and no entry when the audit entry cannot be written: both are taken back', async () => {
    const failing = buildService({ audit: createAuditService({ audit: { ...db.auditRepository, append: () => Promise.reject(new Error('The audit table is not available.')) } }) });
    const target = await addFreeInput('Invented Never Deleted');
    const numbersBefore = await versionNumbers();
    const entriesBefore = await auditEntries();
    await expect(failing.deleteField(admin, target.id, { password: RIGHT })).rejects.toThrow('The audit table is not available.');
    expect(await versionNumbers()).toEqual(numbersBefore);
    expect(await auditEntries()).toEqual(entriesBefore);
  });
});

describe('AC-4: five wrong passwords in a row lock the step-up, and the field is not deleted', () => {
  it('answers 429 STEP_UP_LOCKED from the sixth try, even with the right password, and stores nothing', async () => {
    const target = await addFreeInput('Invented Locked Out');
    const base = await latestNumber();
    for (let attempt = 0; attempt < 5; attempt += 1) await expect(service.deleteField(admin, target.id, { password: WRONG })).rejects.toBeInstanceOf(StepUpFailed);
    await expect(service.deleteField(admin, target.id, { password: RIGHT })).rejects.toBeInstanceOf(StepUpLocked);
    expect(await latestNumber()).toBe(base);
  });
});
