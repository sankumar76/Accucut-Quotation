import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CalculateBlockedError } from '@/lib/errors';
import { fieldLetter } from '@/lib/fields/registry';
import { parseConfigDocument } from '@/lib/fields/schema';
import { createConfigRepository } from '@/server/repositories/config-repository';
import { createAuditService } from '@/server/services/audit-service';
import type { ConfigEditCaller } from '@/server/services/config-edit-service';
import { createConfigStructureService, type ConfigStructureService } from '@/server/services/config-structure-service';
import { createConfigVersionCache } from '@/server/services/config-service';
import type { EstimateViewer } from '@/server/services/estimate-service';

import { createTestHasher, insertUser } from '../../support/builders/user';
import { type CalculationDatabase, openCalculationDatabase } from '../../support/calculation-database';
import { defined } from '../../support/defined';
import { inputAfterAx, outputAfterAx, pairAfterAx } from '../../support/insert-specs';
import { seedConfig } from '../../support/seed-config';

/**
 * STORY-08.03 against real PostgreSQL in a throwaway database, as the runtime role: one new immutable version for one field or for two, with its audit entry in the same transaction (AC-4, AC-9), two inserts
 * from one base (AC-4), a failing audit entry that takes the version back (AC-4), and what an insert does to the estimates (AC-8): a calculation made before keeps its own version and its letters, a Draft with a
 * new mandatory input that has no default is refused by Calculate with the existing missing-input refusal, and one with a default calculates and stores the new column. The audit event `config.field_inserted` is
 * written and read back here, as the registry requires of a wired event. The pure property test (every position, every shape) is `tests/unit/config/field-insert.test.ts`. Every name is invented.
 */

let db: CalculationDatabase;
let service: ConfigStructureService;
let admin: ConfigEditCaller;
/** An estimate calculated with version 1, before any insert: its record must stay on version 1 for good. */
let earlierEstimate: string;
/** A complete Draft made before any insert (it has none of the new inputs). */
let draftWithDefaults: string;

const engineer = (): EstimateViewer => ({ id: db.engineerId, role: 'ENGINEER' });

function buildService(over: { audit?: ReturnType<typeof createAuditService> } = {}): ConfigStructureService {
  return createConfigStructureService({
    configurations: createConfigRepository(db.prisma),
    masters: db.masterRepository,
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
    "SELECT actor_id::text, object_type, object_id::text, object_label, before, after FROM audit_log WHERE event = 'config.field_inserted' ORDER BY created_at",
  );
  return rows;
};

beforeAll(async () => {
  db = await openCalculationDatabase();
  service = buildService();
  const { id } = await insertUser(db.users, createTestHasher(), { email: 'inserter@example.test', name: 'Invented Inserter', role: 'ADMIN', password: 'Tn4#vLm8@Qz-right' });
  admin = { user: { id, name: 'Invented Inserter', role: 'ADMIN' }, requestId: 'req-0000cafe' };
  earlierEstimate = await db.addCompleteEstimate();
  await db.service.calculate(engineer(), earlierEstimate);
  draftWithDefaults = await db.addCompleteEstimate();
}, 120_000);

afterAll(async () => {
  await db.close();
});

describe('AC-4 and AC-9: one new immutable version and one audit entry, together', () => {
  it('stores version 2 for an input: the whole document, one field longer, every old field with its ID, its formula and its label, and only its place changed', async () => {
    const result = await service.insertFields(admin, { spec: inputAfterAx({ label: 'Invented Notch Count', defaultValue: '3.00' }), baseVersion: 1 });
    expect(result).toEqual({ version: 2, letters: ['AY'], message: 'Inserted as AY. Configuration version 2.' });

    const stored = await storedVersion(2);
    expect(stored.created_by).toBe(admin.user.id);
    expect(stored.reason).toBe('Inserted AY Invented Notch Count');
    expect(stored.document.fields).toHaveLength(seedConfig.fields.length + 1);
    // The old fields, in order, with everything but their place as it was; the new one is AY, right after AX (SPEC section 14 item 6).
    const old = stored.document.fields.filter((field) => seedConfig.fields.some((seed) => seed.id === field.id));
    expect(old.map((field) => ({ ...field, position: 0 }))).toEqual(seedConfig.fields.map((field) => ({ ...field, position: 0 })));
    expect(stored.document.fields.map((field) => field.position)).toEqual(stored.document.fields.map((_field, index) => index + 1));
    const added = defined(stored.document.fields.find((field) => !seedConfig.fields.some((seed) => seed.id === field.id)));
    expect(fieldLetter(added)).toBe('AY');
    expect(added).toMatchObject({ kind: 'input', label: 'Invented Notch Count', mandatory: true, engineerVisible: true, defaultValue: '3.00', systemRole: null });
  });

  it('records config.field_inserted in the same transaction: who, the new column, what moved, the version, and nothing else', async () => {
    const entries = await auditEntries();
    expect(entries).toHaveLength(1);
    const entry = defined(entries[0]);
    expect(entry).toMatchObject({ actor_id: admin.user.id, object_type: 'field', object_label: 'AY Invented Notch Count', before: null });
    expect(entry.after).toMatchObject({ version: 2, fields: [{ letter: 'AY', label: 'Invented Notch Count', kind: 'input', follows: 'AX', formula: null }], moved: [{ from: 'AY', to: 'BO', by: 1 }] });
    expect(JSON.stringify(entry)).not.toMatch(/password/i);
  });

  it('stores ONE version for a pair, with the cost formula holding the new input by its ID, and one audit entry', async () => {
    const before = await versionNumbers();
    const result = await service.insertFields(admin, {
      spec: pairAfterAx({ label: 'Invented Rework Count', defaultValue: '2' }),
      baseVersion: await latestNumber(),
    });
    expect(result).toMatchObject({ version: 3, letters: ['AY', 'AZ'] });
    expect(await versionNumbers()).toEqual([...before, 3]);

    const stored = await storedVersion(3);
    const input = defined(stored.document.fields.find((field) => field.label === 'Invented Rework Count'));
    const cost = defined(stored.document.fields.find((field) => field.label === 'Invented Notch Cost'));
    expect(cost.kind === 'output' && cost.formula).toBe(`{{f:${input.id}}} * 2`);
    expect(cost).toMatchObject({ engineerVisible: false, hideWhenZero: input.id });
    expect([fieldLetter(input), fieldLetter(cost)]).toEqual(['AY', 'AZ']);
    const entries = await auditEntries();
    expect(entries).toHaveLength(2);
    expect(entries[1]?.after).toMatchObject({ version: 3, fields: [{ letter: 'AY' }, { letter: 'AZ', kind: 'output', formula: 'AY * 2' }], moved: [{ from: 'AY', to: 'BP', by: 2 }] });
  });

  it('adds an output that joins no stage total and no formula (BR-038): every stored formula of the old fields is the text it was', async () => {
    await service.insertFields(admin, { spec: outputAfterAx({ label: 'Invented Loose Output', formula: '7' }), baseVersion: await latestNumber() });
    const stored = await storedVersion(await latestNumber());
    const loose = defined(stored.document.fields.find((field) => field.label === 'Invented Loose Output'));
    expect(loose).toMatchObject({ kind: 'output', engineerVisible: false, mandatory: false });
    const formulaOf = (document: typeof stored.document, id: string) => document.fields.find((field) => field.id === id);
    for (const field of seedConfig.fields) expect(formulaOf(stored.document, field.id)).toMatchObject({ kind: field.kind, ...(field.kind === 'output' ? { formula: field.formula } : {}) });
  });
});

describe('AC-4: two inserts from the same base, and an audit entry that cannot be written', () => {
  it('stores one and answers the other 409 CONFIG_VERSION_CHANGED with the newer number', async () => {
    const base = await latestNumber();
    const other = buildService();
    const outcomes = await Promise.allSettled([
      service.insertFields(admin, { spec: inputAfterAx({ label: 'Invented Racer One', defaultValue: '1' }), baseVersion: base }),
      other.insertFields(admin, { spec: inputAfterAx({ label: 'Invented Racer Two', defaultValue: '1' }), baseVersion: base }),
    ]);
    const losers = outcomes.filter((outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected');
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(losers[0]?.reason).toMatchObject({ httpStatus: 409, code: 'CONFIG_VERSION_CHANGED', currentVersion: base + 1 });
    expect(await latestNumber()).toBe(base + 1);
    // Exactly one of the two names is in the new version, and the audit log has one entry more, for the winner.
    const stored = await storedVersion(base + 1);
    expect(stored.document.fields.filter((field) => field.label.startsWith('Invented Racer'))).toHaveLength(1);
  });

  it('makes no version and no entry when the audit entry cannot be written: both are taken back', async () => {
    const failing = buildService({
      audit: createAuditService({ audit: { ...db.auditRepository, append: () => Promise.reject(new Error('The audit table is not available.')) } }),
    });
    const numbersBefore = await versionNumbers();
    const entriesBefore = await auditEntries();
    await expect(failing.insertFields(admin, { spec: inputAfterAx({ label: 'Invented Never Stored', defaultValue: '1' }), baseVersion: await latestNumber() })).rejects.toThrow('The audit table is not available.');
    expect(await versionNumbers()).toEqual(numbersBefore);
    expect(await auditEntries()).toEqual(entriesBefore);
  });

  it('stores nothing for a refusal (422) and for a preview', async () => {
    const numbersBefore = await versionNumbers();
    const entriesBefore = await auditEntries();
    await expect(service.insertFields(admin, { spec: inputAfterAx({ label: '  ' }), baseVersion: await latestNumber() })).rejects.toMatchObject({ httpStatus: 422 });
    await service.previewInsert(admin, { spec: pairAfterAx() });
    expect(await versionNumbers()).toEqual(numbersBefore);
    expect(await auditEntries()).toEqual(entriesBefore);
  });
});

describe('AC-8: what an insert does to the estimates', () => {
  it('leaves the calculation made before on version 1, whose letters and cells are as they were: the table cannot change it', async () => {
    const { rows } = await db.owner.query<{ number: number; config_version_id: string }>(
      'SELECT v.number, c.config_version_id::text FROM calculations c JOIN config_versions v ON v.id = c.config_version_id WHERE c.estimate_id = $1::uuid',
      [earlierEstimate],
    );
    expect(rows).toEqual([{ number: 1, config_version_id: db.configVersionId }]);
    const first = await storedVersion(1);
    expect(first.document).toEqual(seedConfig);
    expect(first.document.fields.map((field) => fieldLetter(field)).slice(50, 52)).toEqual(['AY', 'AZ']);
  });

  it('calculates a Draft whose new mandatory inputs all have a default, and stores the new cost column with the default used', async () => {
    const before = await latestNumber();
    const answer = await db.service.calculate(engineer(), draftWithDefaults);
    expect(answer.status).toBe('SUBMITTED');
    const latest = await storedVersion(before);
    const cost = defined(latest.document.fields.find((field) => field.label === 'Invented Notch Cost'));
    const { rows } = await db.owner.query<{ number: number; cost: string | null }>(
      'SELECT v.number, r.outputs ->> $2 AS cost FROM calculations c JOIN config_versions v ON v.id = c.config_version_id JOIN calculation_rows r ON r.calculation_id = c.id WHERE c.estimate_id = $1::uuid',
      [draftWithDefaults, cost.id],
    );
    // Made with the latest version, which holds the new column; the cost is the default (2) times 2.
    expect(defined(rows[0]).number).toBe(before);
    expect(Number(defined(rows[0]).cost)).toBeCloseTo(4, 6);
  });

  it('refuses Calculate for a Draft when a new mandatory input has no default, with the existing missing-input refusal, and writes nothing', async () => {
    await service.insertFields(admin, { spec: inputAfterAx({ label: 'Invented Needs A Value', defaultValue: '' }), baseVersion: await latestNumber() });
    const draft = await db.addCompleteEstimate();
    const error = await db.service.calculate(engineer(), draft).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(CalculateBlockedError);
    const { rows } = await db.owner.query<{ count: string }>('SELECT count(*) FROM calculations WHERE estimate_id = $1::uuid', [draft]);
    expect(rows).toEqual([{ count: '0' }]);
    // The refusal names the part and the field, as it does for every missing input (the form shows "Enter this value." on it); it carries no value.
    expect(error instanceof CalculateBlockedError && error.parts.map((part) => [part.slNo, part.fields.map((field) => field.label)])).toEqual([['1', ['Invented Needs A Value']]]);
  });
});
