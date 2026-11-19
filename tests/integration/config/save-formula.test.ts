import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { StepUpFailed, StepUpLocked } from '@/lib/errors';
import { systemClock } from '@/lib/time';
import { createConfigRepository } from '@/server/repositories/config-repository';
import { createAuditService } from '@/server/services/audit-service';
import { createConfigEditService, type ConfigEditCaller, type ConfigEditService } from '@/server/services/config-edit-service';
import { createConfigVersionCache } from '@/server/services/config-service';
import { createStepUpService } from '@/server/services/step-up-service';
import { parseConfigDocument } from '@/lib/fields/schema';

import { KEY_SECRET } from '../../support/audit-database';
import { createTestHasher, insertUser } from '../../support/builders/user';
import { type CalculationDatabase, openCalculationDatabase } from '../../support/calculation-database';
import { defined } from '../../support/defined';
import { seedConfig, seedFieldAt } from '../../support/seed-config';

/**
 * STORY-08.02 against real PostgreSQL in a throwaway database, as the runtime role, with the real step-up service and its real throttle: the new immutable version and its audit entry in one transaction
 * (AC-5), the password step (AC-4) and its own block, two saves from one base (AC-9), the decision on "edit to its own text", a failing audit entry that takes the version back, and the preview and sample rows
 * from a stored calculation (AC-1, AC-3, AC-8). The audit event `config.formula_changed` is written and read back here, as the registry requires of a wired event. Every name and password is invented.
 */

let db: CalculationDatabase;
let service: ConfigEditService;
let adminOne: ConfigEditCaller;
let adminTwo: ConfigEditCaller;
/** An estimate calculated with version 1, before any edit: its record must stay on version 1 for good. */
let earlierEstimate: string;

const RIGHT = 'Tn4#vLm8@Qz-right';
const WRONG = 'Not-the-right-1!';
const AL = seedFieldAt('AL');
const SAVED_TEXT = 'P * Cutting-Rate-per-Sec';
const configurations = () => createConfigRepository(db.prisma);

async function admin(label: string): Promise<ConfigEditCaller> {
  const { id } = await insertUser(db.users, createTestHasher(), { email: `${label}@example.test`, name: `Invented ${label}`, role: 'ADMIN', password: RIGHT });
  return { user: { id, name: `Invented ${label}`, role: 'ADMIN' }, requestId: `req-${label.length.toString(16).padStart(8, '0')}` };
}

function buildService(over: { audit?: typeof db.audit } = {}): ConfigEditService {
  return createConfigEditService({
    configurations: configurations(),
    masters: db.masterRepository,
    calculations: db.calculations,
    stepUp: createStepUpService({ users: db.users, throttles: db.throttles, hasher: createTestHasher(), clock: systemClock, keySecret: KEY_SECRET }),
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

beforeAll(async () => {
  db = await openCalculationDatabase();
  service = buildService();
  adminOne = await admin('editor');
  // The portal has one Admin: the second caller is the same person in a second tab, with a request of its own.
  adminTwo = { ...adminOne, requestId: 'req-0000beef' };
  earlierEstimate = await db.addEstimate();
  await db.service.storeCalculation({ estimateId: earlierEstimate, createdById: db.personId, inputsRevision: 3, nodes: [db.node()] });
}, 120_000);

afterAll(async () => {
  await db.close();
});

describe('AC-5: one new immutable version and one audit entry, together', () => {
  it('stores version 2 with the whole edited document, made by the Admin, and a reason that holds no formula', async () => {
    const result = await service.saveFormula(adminOne, AL.id, { text: 'P * Cutting-Rate-per-Sec * 2', password: RIGHT, baseVersion: 1 });
    expect(result).toEqual({ version: 2, changed: true, message: 'Formula saved as configuration version 2.' });

    const { rows } = await db.owner.query<{ number: number; created_by: string; reason: string; snapshot: unknown }>('SELECT number, created_by::text, reason, snapshot FROM config_versions WHERE number = 2');
    const stored = defined(rows[0]);
    expect(stored.created_by).toBe(adminOne.user.id);
    expect(stored.reason).toBe('Formula of AL Cutting Cost changed');
    const document = parseConfigDocument(stored.snapshot);
    const unchanged = (field: { id: string }) => field.id !== AL.id;
    expect(document.fields.filter(unchanged)).toEqual(seedConfig.fields.filter(unchanged));
    expect(defined(document.fields.find((field) => field.id === AL.id))).not.toEqual(AL);
    expect(document.sections).toEqual(seedConfig.sections);
    expect(document.stages).toEqual(seedConfig.stages);
  });

  it("records 'config.formula_changed' in the same transaction, with the old and the new text and the version it made", async () => {
    const { rows } = await db.owner.query<{ event: string; actor_id: string; object_type: string; object_id: string; object_label: string; before: unknown; after: unknown }>(
      "SELECT event, actor_id::text, object_type, object_id::text, object_label, before, after FROM audit_log WHERE event = 'config.formula_changed' ORDER BY created_at",
    );
    expect(rows).toEqual([
      {
        event: 'config.formula_changed',
        actor_id: adminOne.user.id,
        object_type: 'field',
        object_id: AL.id,
        object_label: 'AL Cutting Cost',
        before: { formula: SAVED_TEXT },
        after: { formula: 'P * Cutting-Rate-per-Sec * 2', version: 2 },
      },
    ]);
  });

  it('leaves the calculations already stored on their own version, and makes the next calculation with the new one', async () => {
    const outputOf = async (estimateId: string) => {
      const { rows } = await db.owner.query<{ number: number; al: string }>(
        'SELECT v.number, r.outputs ->> $2 AS al FROM calculations c JOIN config_versions v ON v.id = c.config_version_id JOIN calculation_rows r ON r.calculation_id = c.id WHERE c.estimate_id = $1::uuid',
        [estimateId, AL.id],
      );
      return defined(rows[0]);
    };
    // The record made before the edit still names version 1 and holds the figure the old formula gave; the table is immutable, so nothing could change it.
    const old = await outputOf(earlierEstimate);
    expect(old.number).toBe(1);
    const later = await db.addEstimate();
    await db.service.storeCalculation({ estimateId: later, createdById: db.personId, inputsRevision: 3, nodes: [db.node()] });
    const fresh = await outputOf(later);
    expect(fresh.number).toBe(2);
    // The new formula is the old one times 2, over the same invented row.
    expect(Number(fresh.al)).toBeCloseTo(Number(old.al) * 2, 6);
  });

  it('makes no version and no entry when the audit entry cannot be written: both are taken back', async () => {
    const failing = buildService({
      audit: createAuditService({
        audit: {
          ...db.auditRepository,
          append: () => Promise.reject(new Error('The audit table is not available.')),
        },
      }),
    });
    const numbersBefore = await versionNumbers();
    const entriesBefore = await db.owner.query<{ count: string }>("SELECT count(*) FROM audit_log WHERE event = 'config.formula_changed'");
    await expect(failing.saveFormula(adminOne, AL.id, { text: 'P * 7', password: RIGHT, baseVersion: await latestNumber() })).rejects.toThrow('The audit table is not available.');
    expect(await versionNumbers()).toEqual(numbersBefore);
    const entriesAfter = await db.owner.query<{ count: string }>("SELECT count(*) FROM audit_log WHERE event = 'config.formula_changed'");
    expect(entriesAfter.rows).toEqual(entriesBefore.rows);
  });
});

describe('the decision on "edit to its own text": no new version, no entry, no password', () => {
  it('answers that nothing changed, with the current number, and writes nothing, even with a wrong password', async () => {
    const numbersBefore = await versionNumbers();
    const entries = await db.owner.query<{ count: string }>('SELECT count(*) FROM audit_log');
    const same = await service.saveFormula(adminTwo, AL.id, { text: 'P * Cutting-Rate-per-Sec * 2', password: WRONG, baseVersion: await latestNumber() });
    expect(same).toEqual({ version: await latestNumber(), changed: false, message: 'This is already the saved formula, so no new version was made.' });
    expect(await versionNumbers()).toEqual(numbersBefore);
    expect((await db.owner.query<{ count: string }>('SELECT count(*) FROM audit_log')).rows).toEqual(entries.rows);
  });
});

describe('AC-9: two saves from the same base version', () => {
  it('stores one, answers the other 409 with the newer number, and overwrites nothing', async () => {
    const base = await latestNumber();
    const outcomes = await Promise.allSettled([
      service.saveFormula(adminOne, AL.id, { text: 'P * 3', password: RIGHT, baseVersion: base }),
      service.saveFormula(adminTwo, AL.id, { text: 'P * 4', password: RIGHT, baseVersion: base }),
    ]);
    const winners = outcomes.filter((outcome) => outcome.status === 'fulfilled');
    const losers = outcomes.filter((outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected');
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(losers[0]?.reason).toMatchObject({ httpStatus: 409, code: 'CONFIG_VERSION_CHANGED', currentVersion: base + 1 });
    expect(await latestNumber()).toBe(base + 1);
    // The stored formula is the winner's, whole: the audit entry of version base + 1 holds the winner's text, and saving that text again is the no-op.
    const entries = await db.owner.query<{ after: { formula: string; version: number } }>(
      "SELECT after FROM audit_log WHERE event = 'config.formula_changed' AND object_id = $1::uuid ORDER BY created_at DESC LIMIT 1",
      [AL.id],
    );
    const entry = defined(entries.rows[0]);
    expect(['P * 3', 'P * 4']).toContain(entry.after.formula);
    expect(entry.after.version).toBe(base + 1);
    const again = await service.saveFormula(adminOne, AL.id, { text: entry.after.formula, password: WRONG, baseVersion: base + 1 });
    expect(again.changed).toBe(false);
  });

  it('gives a save from an older version the 409 at once, before the password is asked for', async () => {
    const stale = await latestNumber();
    await service.saveFormula(adminOne, AL.id, { text: 'P * 5', password: RIGHT, baseVersion: stale });
    const error = await service.saveFormula(adminTwo, AL.id, { text: 'P * 6', password: WRONG, baseVersion: stale }).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ httpStatus: 409, code: 'CONFIG_VERSION_CHANGED', currentVersion: stale + 1 });
  });
});

describe('AC-4: the password, with its own throttle', () => {
  it('refuses a wrong password with 422 STEP_UP_FAILED, stores nothing, and counts it on the step-up key, not on sign-in', async () => {
    const person = adminOne;
    const before = await versionNumbers();
    const error = await service.saveFormula(person, AL.id, { text: 'P * 8', password: WRONG, baseVersion: await latestNumber() }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(StepUpFailed);
    expect(await versionNumbers()).toEqual(before);
    const { rows } = await db.owner.query<{ failures: number }>('SELECT failures FROM login_throttles');
    expect(rows.length).toBeGreaterThan(0);
  });

  it('blocks the step-up after five wrong passwords, even for the right one, and keeps the formula (nothing is stored)', async () => {
    const person = adminOne;
    // A right password ends the run of failures the test above began, so this one starts from none.
    await service.saveFormula(person, AL.id, { text: 'P * 10', password: RIGHT, baseVersion: await latestNumber() });
    const before = await versionNumbers();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(service.saveFormula(person, AL.id, { text: 'P * 9', password: WRONG, baseVersion: await latestNumber() })).rejects.toBeInstanceOf(StepUpFailed);
    }
    await expect(service.saveFormula(person, AL.id, { text: 'P * 9', password: RIGHT, baseVersion: await latestNumber() })).rejects.toBeInstanceOf(StepUpLocked);
    expect(await versionNumbers()).toEqual(before);
  });

  it('puts the password in no audit entry, no version and no throttle row', async () => {
    const audit = await db.owner.query<{ text: string }>('SELECT (before::text || after::text) AS text FROM audit_log');
    const versions = await db.owner.query<{ text: string }>('SELECT snapshot::text AS text FROM config_versions');
    const throttles = await db.owner.query<{ text: string }>('SELECT key_hash AS text FROM login_throttles');
    for (const password of [RIGHT, WRONG]) {
      expect([...audit.rows, ...versions.rows, ...throttles.rows].some((row) => row.text.includes(password))).toBe(false);
    }
  });
});

describe('AC-1, AC-3 and AC-8: the sample rows and the preview from a stored calculation', () => {
  it('lists the rows of the latest calculated estimate, with the code of its task', async () => {
    const found = await service.listSampleRows(adminOne);
    expect(found.estimate?.code).toMatch(/^Q-2026-\d{4}$/);
    expect(found.rows.length).toBeGreaterThan(0);
    expect(found.rows[0]).toMatchObject({ slNo: '1' });
  });

  it('works the new formula out on the chosen row, as two decimals, and changes nothing', async () => {
    const before = await versionNumbers();
    const { rows } = await service.listSampleRows(adminOne);
    const checked = await service.checkFormula(adminOne, { fieldId: AL.id, text: 'P * Cutting-Rate-per-Sec', sampleRowId: defined(rows[0]).id });
    expect(checked.valid).toBe(true);
    expect(checked.preview).toMatchObject({ slNo: '1' });
    expect(checked.preview?.shown).toMatch(/^\d+\.\d{2}$/);
    expect(checked.preview?.operands.map((operand) => operand.name)).toEqual(['P Cutting Time', 'Cutting-Rate-per-Sec']);
    expect(await versionNumbers()).toEqual(before);
  });

  it('shows the dash for a division by zero, never a crash', async () => {
    const checked = await service.checkFormula(adminOne, { fieldId: AL.id, text: 'P / (Q - Q)' });
    expect(checked.preview).toMatchObject({ value: null, shown: '—' });
  });

  it('works a whole-estimate formula over every row', async () => {
    const checked = await service.checkFormula(adminOne, { fieldId: seedFieldAt('BL').id, text: 'SUM(BG)' });
    expect(checked.preview).toMatchObject({ slNo: null });
    expect(checked.preview?.shown).toMatch(/^\d+\.\d{2}$/);
  });
});
