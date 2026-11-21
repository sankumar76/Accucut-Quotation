import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { parseConfigDocument } from '@/lib/fields/schema';
import { createConfigRepository } from '@/server/repositories/config-repository';
import { createAuditService } from '@/server/services/audit-service';
import type { ConfigEditCaller } from '@/server/services/config-edit-service';
import { createConfigStructureService, type ConfigStructureService } from '@/server/services/config-structure-service';
import { createConfigVersionCache } from '@/server/services/config-service';

import { createTestHasher, insertUser } from '../../support/builders/user';
import { type CalculationDatabase, openCalculationDatabase } from '../../support/calculation-database';
import { CHOICE_LABEL, CHOICE_OPTIONS, choiceInput, NEW_SECTION_NAME } from '../../support/choice-section-version';
import { defined } from '../../support/defined';
import { inputAfterAx } from '../../support/insert-specs';
import { seedConfig } from '../../support/seed-config';

/**
 * STORY-08.08 AC-6 and AC-7 (FR-074, FR-077) against real PostgreSQL in a throwaway database, as the runtime role, through the real insert service: a choice input put into **a new section** is **one** new
 * immutable version that holds the section and the field, with the audit entry `config.field_inserted` naming the new section and the number of choices; a refusal (a bad list of choices, a bad section name)
 * is 422 and stores nothing; a failing audit entry takes the version, the section and the field back together; a second new section takes the next number. The pure rules are
 * `tests/unit/config/field-insert-choice.test.ts`; what the Engineer then sees is `tests/integration/estimates/choice-input.test.ts`. Every name is invented.
 */

let db: CalculationDatabase;
let admin: ConfigEditCaller;
let service: ConfigStructureService;

function buildService(audit = db.audit): ConfigStructureService {
  return createConfigStructureService({
    configurations: createConfigRepository(db.prisma),
    masters: db.masterRepository,
    stepUp: { verifyStepUp: () => Promise.reject(new Error('An insert must not ask for a password.')) },
    transactions: db.transactions,
    audit,
    cache: createConfigVersionCache(),
  });
}

async function versionNumbers(): Promise<number[]> {
  const { rows } = await db.owner.query<{ number: number }>('SELECT number FROM config_versions ORDER BY number');
  return rows.map((row) => row.number);
}

const latest = async (): Promise<number> => defined((await versionNumbers()).at(-1));

async function storedVersion(number: number) {
  const { rows } = await db.owner.query<{ snapshot: unknown }>('SELECT snapshot FROM config_versions WHERE number = $1', [number]);
  return parseConfigDocument(defined(rows[0]).snapshot);
}

const auditEntries = async () => {
  const { rows } = await db.owner.query<{ object_label: string; before: unknown; after: Record<string, unknown> }>("SELECT object_label, before, after FROM audit_log WHERE event = 'config.field_inserted' ORDER BY created_at");
  return rows;
};

beforeAll(async () => {
  db = await openCalculationDatabase();
  service = buildService();
  const { id } = await insertUser(db.users, createTestHasher(), { email: 'sectioner@example.test', name: 'Invented Sectioner', role: 'ADMIN', password: 'Tn4#vLm8@Qz-right' });
  admin = { user: { id, name: 'Invented Sectioner', role: 'ADMIN' }, requestId: 'req-0000cafe' };
}, 120_000);

afterAll(async () => {
  await db.close();
});

describe('AC-7: one version, one transaction', () => {
  it('stores ONE version that holds the new section (number 9, cards) and the choice input with its options in order', async () => {
    const result = await service.insertFields(admin, { spec: inputAfterAx(choiceInput({ choices: '  Coarse \n\nFine\nMirror ' })), baseVersion: 1 });
    expect(result).toEqual({ version: 2, letters: ['AY'], message: 'Inserted as AY. Configuration version 2.' });
    expect(await versionNumbers()).toEqual([1, 2]);

    const document = await storedVersion(2);
    expect(document.sections).toHaveLength(seedConfig.sections.length + 1);
    const section = defined(document.sections.at(-1));
    expect(section).toMatchObject({ number: 9, name: NEW_SECTION_NAME, shortName: 'Finishing', displayMode: 'cards' });
    const field = defined(document.fields.find((candidate) => candidate.label === CHOICE_LABEL));
    expect(field).toMatchObject({ kind: 'input', dataType: 'select', options: [...CHOICE_OPTIONS], sectionId: section.id, mandatory: true, engineerVisible: true });
    // Version 1 is as it was: nothing of an earlier version is ever changed (NFR-026).
    expect(await storedVersion(1)).toEqual(seedConfig);
  });

  it('records config.field_inserted with the new section and the number of choices in its After and in its words', async () => {
    const entries = await auditEntries();
    expect(entries).toHaveLength(1);
    const entry = defined(entries[0]);
    expect(entry).toMatchObject({ object_label: `AY ${CHOICE_LABEL}`, before: null });
    expect(entry.after).toMatchObject({ version: 2, choices: 3, section: { number: 9, name: NEW_SECTION_NAME }, fields: [{ letter: 'AY', kind: 'input', follows: 'AX' }] });
  });

  it('takes the next number for a second new section, and a Number input needs no choices', async () => {
    const result = await service.insertFields(admin, {
      spec: inputAfterAx(choiceInput({ label: 'Invented Count In Checking', dataType: 'number', numFmt: '0.00', choices: '', newSection: { name: 'Invented Checking', shortName: 'Checking' } })),
      baseVersion: await latest(),
    });
    expect(result.version).toBe(3);
    const document = await storedVersion(3);
    expect(document.sections.map((section) => section.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(defined((await auditEntries())[1]).after).toMatchObject({ choices: null, section: { number: 10, name: 'Invented Checking' } });
  });

  it('puts a choice into an existing section too, with no new section stored', async () => {
    const before = (await storedVersion(await latest())).sections.length;
    const existing = defined(seedConfig.sections[1]).id;
    await service.insertFields(admin, { spec: inputAfterAx(choiceInput({ label: 'Invented Choice In Two', newSection: null, sectionId: existing })), baseVersion: await latest() });
    const document = await storedVersion(await latest());
    expect(document.sections).toHaveLength(before);
    expect(document.fields.find((field) => field.label === 'Invented Choice In Two')).toMatchObject({ sectionId: existing });
    expect(defined((await auditEntries()).at(-1)).after).toMatchObject({ choices: 3, section: null });
  });
});

describe('AC-6, AC-7: a refusal or a failure stores nothing', () => {
  it('answers 422 for each bad list and each bad section name, and stores no version, no section and no entry', async () => {
    const numbers = await versionNumbers();
    const entries = await auditEntries();
    const bad = [
      { choices: '   ' },
      { choices: 'Fine\nFINE' },
      { choices: Array.from({ length: 51 }, (_, index) => `Choice ${String(index)}`).join('\n') },
      { choices: 'x'.repeat(101) },
      { defaultValue: 'Not a choice' },
      { newSection: { name: '', shortName: 'Short' } },
      { newSection: { name: 'Name', shortName: 's'.repeat(31) } },
    ];
    for (const overrides of bad) {
      await expect(service.insertFields(admin, { spec: inputAfterAx(choiceInput({ label: 'Invented Never Stored', ...overrides })), baseVersion: await latest() }), JSON.stringify(overrides)).rejects.toMatchObject({ httpStatus: 422 });
    }
    expect(await versionNumbers()).toEqual(numbers);
    expect(await auditEntries()).toEqual(entries);
  });

  it('takes the version, the section and the field back together when the audit entry cannot be written', async () => {
    const failing = buildService(createAuditService({ audit: { ...db.auditRepository, append: () => Promise.reject(new Error('The audit table is not available.')) } }));
    const numbers = await versionNumbers();
    const sections = (await storedVersion(await latest())).sections.length;
    await expect(failing.insertFields(admin, { spec: inputAfterAx(choiceInput({ label: 'Invented Rolled Back', newSection: { name: 'Invented Rolled', shortName: 'Rolled' } })), baseVersion: await latest() })).rejects.toThrow('The audit table is not available.');
    expect(await versionNumbers()).toEqual(numbers);
    expect((await storedVersion(await latest())).sections).toHaveLength(sections);
  });
});
