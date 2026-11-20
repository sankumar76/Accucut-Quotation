import { describe, expect, it } from 'vitest';

import { createAuditService } from '@/server/services/audit-service';
import { createConfigStructureService, type ConfigStructureService } from '@/server/services/config-structure-service';
import { createConfigVersionCache } from '@/server/services/config-service';
import type { ConfigRepository, ConfigVersionRecord } from '@/server/repositories/config-repository';
import type { ConfigEditCaller } from '@/server/services/config-edit-service';

import { createFakeAuditWorld } from '../../support/fake-audit';
import { defined } from '../../support/defined';
import { fieldIdAt, inputAfterAx, outputAfterAx, pairAfterAx } from '../../support/insert-specs';
import { SEED_PROCESS_ITEMS, seedConfig } from '../../support/seed-config';

/**
 * STORY-08.03 AC-1, AC-3, AC-4, AC-7 and AC-9 at the rules, with no database: who may call (the Admin alone, checked before anything is read), what the options hold, that the preview stores nothing and is
 * the save's own check, the order of the save's checks (base version, then the 422, then one transaction), what each refusal costs (nothing is written), one version for one field or two, and the audit entry. The
 * real table, the transaction, two inserts racing and the audit rollback are `tests/integration/config/insert-field.test.ts`. Every name is invented.
 */

const ADMIN: ConfigEditCaller = { user: { id: '00000000-0000-4000-8000-0000000000a1', name: 'Invented Admin', role: 'ADMIN' }, requestId: 'req-0000aaaa' };
const LEAD: ConfigEditCaller = { user: { id: '00000000-0000-4000-8000-0000000000b1', name: 'Invented Lead', role: 'LEAD' }, requestId: 'req-0000bbbb' };
const ENGINEER: ConfigEditCaller = { user: { id: '00000000-0000-4000-8000-0000000000c1', name: 'Invented Engineer', role: 'ENGINEER' }, requestId: 'req-0000cccc' };

function record(number: number, snapshot: unknown): ConfigVersionRecord {
  return { id: `00000000-0000-4000-8000-0ccc000000${String(number).padStart(2, '0')}`, number, snapshot, createdBy: null, reason: 'Invented', createdAt: new Date('2026-11-05T09:00:00.000Z') };
}

interface World {
  readonly service: ConfigStructureService;
  readonly versions: ConfigVersionRecord[];
  readonly inserts: Array<{ baseNumber: number; snapshot: unknown; reason: string; createdBy: string }>;
  readonly reads: { latest: number };
  readonly audit: ReturnType<typeof createFakeAuditWorld>;
}

function world(beforeInsert?: (versions: ConfigVersionRecord[]) => void, extraRates: ReadonlyArray<{ id: string; name: string }> = []): World {
  const versions = [record(1, seedConfig)];
  const inserts: World['inserts'] = [];
  const reads = { latest: 0 };
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
      reads.latest += 1;
      const latest = versions.reduce((best, each) => (each.number > best.number ? each : best));
      return Promise.resolve({ id: latest.id, number: latest.number });
    },
    findById: (id) => Promise.resolve(versions.find((each) => each.id === id) ?? null),
    readVersionUse: () => Promise.resolve({ savedByName: null, estimatesInUse: 0 }),
  };
  const audit = createFakeAuditWorld();
  const service = createConfigStructureService({
    configurations,
    masters: { listProcessItems: () => Promise.resolve([...SEED_PROCESS_ITEMS, ...extraRates.map((rate) => ({ ...rate, unit: 'per piece' }))].map((item) => ({ ...item, defaultValue: '0.00' }))) },
    transactions: audit.transactions,
    audit: createAuditService({ audit: audit.audit }),
    cache: createConfigVersionCache(),
  });
  return { service, versions, inserts, reads, audit };
}

const rejection = async (promise: Promise<unknown>): Promise<Error & { code?: string; httpStatus?: number; fields?: Array<{ field: string; message: string }>; currentVersion?: number }> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof Error) return error;
  }
  throw new Error('Expected a refusal.');
};

describe('AC-1: the Admin alone, checked again before anything is read', () => {
  it.each([
    ['a Lead', LEAD],
    ['an Engineer', ENGINEER],
  ])('refuses %s with 403 on every method and reads and writes nothing', async (_who, caller) => {
    const w = world();
    for (const call of [
      () => w.service.getInsertOptions(caller),
      () => w.service.previewInsert(caller, { spec: inputAfterAx() }),
      () => w.service.insertFields(caller, { spec: inputAfterAx(), baseVersion: 1 }),
    ]) {
      expect(await rejection(call())).toMatchObject({ httpStatus: 403 });
    }
    expect(w.reads.latest).toBe(0);
    expect(w.inserts).toEqual([]);
    expect(w.audit.audit.committed).toEqual([]);
  });
});

describe('AC-2: what the wizard offers', () => {
  it('lists every column in order with its letter, the sections of the Engineer form, the stages with their sub-headings and the formats the registry uses, and the version it is opened on', async () => {
    const options = await world().service.getInsertOptions(ADMIN);
    expect(options.version).toBe(1);
    expect(options.columns).toHaveLength(seedConfig.fields.length);
    expect(options.columns[0]).toMatchObject({ letter: 'A', kind: 'auto' });
    expect(options.columns.find((column) => column.letter === 'AX')).toMatchObject({ id: fieldIdAt('AX') });
    expect(options.sections.map((section) => section.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(options.stages.map((stage) => stage.number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(options.numberFormats).toEqual(expect.arrayContaining(['0.00', '#,##0.00', '@']));
  });

  it('marks only an input that holds a value (not a picture, an output or an auto column) as one a rule may watch', async () => {
    const options = await world().service.getInsertOptions(ADMIN);
    const watchable = options.columns.filter((column) => column.watchable);
    expect(watchable.length).toBeGreaterThan(0);
    expect(watchable.every((column) => column.kind === 'input')).toBe(true);
    expect(options.columns.find((column) => column.letter === 'C')).toMatchObject({ kind: 'input', watchable: false });
  });

  it('marks only an input that holds a number (a Number or a flag) as one that may hide a line (review SQR-01): not a text, a choice, a picture or an output', async () => {
    const { columns } = await world().service.getInsertOptions(ADMIN);
    const hideable = (letter: string) => defined(columns.find((column) => column.letter === letter)).hideable;
    expect(['J', 'Z', 'AA'].map(hideable)).toEqual([true, true, true]);
    expect(['A', 'B', 'C', 'E', 'G', 'AY', 'BL'].map(hideable)).toEqual([false, false, false, false, false, false, false]);
  });

  it('holds no formula, rate name or rate value: only names and structure (NFR-002)', async () => {
    const text = JSON.stringify(await world().service.getInsertOptions(ADMIN));
    expect(text).not.toMatch(/Cutting-Rate|\{\{|formula/i);
  });
});

describe('AC-3: the preview is the save\'s own check and stores nothing', () => {
  it('gives the SPEC 14.6 example: an input after AX is AY, AY to BO move one place, and the product cells move with their columns', async () => {
    const w = world();
    const preview = await w.service.previewInsert(ADMIN, { spec: inputAfterAx() });
    expect(preview.baseVersion).toBe(1);
    expect(preview.inserted).toEqual([expect.objectContaining({ letter: 'AY', followsLetter: 'AX', kind: 'input' })]);
    expect(preview.moved[0]).toMatchObject({ from: 'AY', to: 'AZ' });
    expect(preview.moved.at(-1)).toMatchObject({ from: 'BO', to: 'BP' });
    expect(preview.productCells).toEqual([
      { label: expect.any(String), from: 'BL2', to: 'BM2' },
      { label: expect.any(String), from: 'BN2', to: 'BO2' },
      { label: expect.any(String), from: 'BO2', to: 'BP2' },
    ]);
    expect(w.inserts).toEqual([]);
    expect(w.versions).toHaveLength(1);
    expect(w.audit.audit.committed).toEqual([]);
  });

  it('shows a pair in one table, with the cost column\'s formula in its final letters', async () => {
    const preview = await world().service.previewInsert(ADMIN, { spec: pairAfterAx() });
    expect(preview.inserted.map((field) => field.letter)).toEqual(['AY', 'AZ']);
    expect(preview.moved[0]).toMatchObject({ from: 'AY', to: 'BA' });
    expect(preview.formulas).toEqual([{ letter: 'AZ', label: 'Invented Notch Cost', formula: 'AY * 2' }]);
  });

  it('works out the letters alone from the places, while the details are still being typed (the live list)', async () => {
    const preview = await world().service.previewInsert(ADMIN, { spec: inputAfterAx({ label: '', sectionId: '', width: 0 }), lettersOnly: true });
    expect(preview.inserted[0]).toMatchObject({ letter: 'AY', label: 'New field' });
    expect(preview.formulas).toEqual([]);
  });

  it('refuses a place that names no column, in both modes, in the words of the story', async () => {
    const lost = { ...inputAfterAx(), afterFieldId: 'no-such-column' };
    for (const lettersOnly of [true, false]) {
      expect(await rejection(world().service.previewInsert(ADMIN, { spec: lost, lettersOnly }))).toMatchObject({ httpStatus: 422, fields: [{ field: 'afterFieldId', message: 'Choose the column to insert after.' }] });
    }
  });

  it('gives the same letters for the preview as the save stores', async () => {
    const w = world();
    const preview = await w.service.previewInsert(ADMIN, { spec: pairAfterAx() });
    const saved = await w.service.insertFields(ADMIN, { spec: pairAfterAx(), baseVersion: 1 });
    expect(saved.letters).toEqual(preview.inserted.map((field) => field.letter));
  });
});

describe('AC-7: the server checks everything again, so a client that skipped the preview still gets the 422', () => {
  it.each([
    ['an empty label', inputAfterAx({ label: '   ' }), { field: 'input.label', message: 'Enter a label.' }],
    ['no section', inputAfterAx({ sectionId: '' }), { field: 'input.sectionId', message: 'Choose a section.' }],
    ['a width of 0', inputAfterAx({ width: 0 }), { field: 'input.width', message: 'Enter a width from 1 to 255.' }],
    ['a width of 300', inputAfterAx({ width: 300 }), { field: 'input.width', message: 'Enter a width from 1 to 255.' }],
    ['a format the worksheet does not use', inputAfterAx({ numFmt: 'dd/mm' }), { field: 'input.numFmt', message: 'Choose one of the number formats the worksheet uses.' }],
    ['a default that is not a number', inputAfterAx({ defaultValue: 'abc' }), { field: 'input.defaultValue', message: expect.any(String) as string }],
    ['a watched field that is not an input', inputAfterAx({ watchFieldId: fieldIdAt('AL') }), { field: 'input.watchFieldId', message: 'Choose the field to watch.' }],
  ])('refuses %s with 422 under the control, and stores nothing', async (_what, spec, issue) => {
    const w = world();
    expect(await rejection(w.service.insertFields(ADMIN, { spec, baseVersion: 1 }))).toMatchObject({ httpStatus: 422, fields: [issue] });
    expect(w.inserts).toEqual([]);
    expect(w.audit.audit.committed).toEqual([]);
  });

  it('refuses a single output whose formula names its own new letter, as a loop (SCR-18\'s words)', async () => {
    const w = world();
    const error = await rejection(w.service.insertFields(ADMIN, { spec: outputAfterAx({ formula: 'AY * 2' }), baseVersion: 1 }));
    expect(error).toMatchObject({ httpStatus: 422, fields: [{ field: 'output.formula' }] });
    expect(defined(error.fields?.[0]).message).toMatch(/depend on itself/);
    expect(w.inserts).toEqual([]);
  });

  it('refuses an unknown name in a formula with the SCR-18 words', async () => {
    const error = await rejection(world().service.insertFields(ADMIN, { spec: outputAfterAx({ formula: 'P * Cuting-Rate-per-Sec' }), baseVersion: 1 }));
    expect(error).toMatchObject({ httpStatus: 422, fields: [{ field: 'output.formula', message: expect.stringContaining('Cuting-Rate-per-Sec') as string }] });
  });
});

describe('AC-4: one new version for one field or two, with the base version checked first', () => {
  it('stores one version for an input, made from the version the wizard was opened on, and says so in the words of the story', async () => {
    const w = world();
    const saved = await w.service.insertFields(ADMIN, { spec: inputAfterAx(), baseVersion: 1 });
    expect(saved).toEqual({ version: 2, letters: ['AY'], message: 'Inserted as AY. Configuration version 2.' });
    expect(w.inserts).toHaveLength(1);
    expect(w.inserts[0]).toMatchObject({ baseNumber: 1, createdBy: ADMIN.user.id, reason: 'Inserted AY Invented Notch Count' });
    expect(w.versions).toHaveLength(2);
  });

  it('stores one version for a pair, not two', async () => {
    const w = world();
    const saved = await w.service.insertFields(ADMIN, { spec: pairAfterAx(), baseVersion: 1 });
    expect(saved).toEqual({ version: 2, letters: ['AY', 'AZ'], message: 'Inserted as AY and AZ. Configuration version 2.' });
    expect(w.inserts).toHaveLength(1);
    expect(w.versions).toHaveLength(2);
  });

  it('refuses a stale base version with 409 and the newer number, and checks nothing else and stores nothing', async () => {
    const w = world();
    await w.service.insertFields(ADMIN, { spec: inputAfterAx(), baseVersion: 1 });
    const stale = await rejection(w.service.insertFields(ADMIN, { spec: inputAfterAx({ label: '' }), baseVersion: 1 }));
    expect(stale).toMatchObject({ httpStatus: 409, code: 'CONFIG_VERSION_CHANGED', currentVersion: 2 });
    expect(stale.message).toBe('The fields and formulas were changed while you were inserting. They are now at configuration version 2. Nothing was inserted; start again to see what changed.');
    expect(w.inserts).toHaveLength(1);
  });

  it('lets only one of two inserts from the same base win: the version stored under the other is refused, with its audit entry, as 409', async () => {
    // Another save lands between the check and the write: the store refuses the insert because its base is no longer the latest.
    const w = world((versions) => {
      versions.push(record(2, seedConfig));
    });
    const lost = await rejection(w.service.insertFields(ADMIN, { spec: inputAfterAx(), baseVersion: 1 }));
    expect(lost).toMatchObject({ httpStatus: 409, code: 'CONFIG_VERSION_CHANGED', currentVersion: 2 });
    expect(w.versions).toHaveLength(2);
    expect(w.audit.audit.committed).toEqual([]);
  });

  it('asks for no password: the call has no password in it and the service has no step-up dependency (FR-080)', async () => {
    const saved = await world().service.insertFields(ADMIN, { spec: inputAfterAx(), baseVersion: 1 });
    expect(saved.version).toBe(2);
  });
});

describe('review SQR-02: a formula longer in display form than in stored form still saves, and its entry is written', () => {
  it('saves a cost formula that names a 100-character rate 25 times (about 2,600 characters displayed) and records it whole', async () => {
    const rate = { id: '00000000-0000-4000-8000-000400000099', name: `Invented-Long-Rate-${'x'.repeat(81)}` };
    expect(rate.name).toHaveLength(100);
    const formula = Array.from({ length: 25 }, () => rate.name).join(' + ');
    expect(formula.length).toBeGreaterThan(2_000);
    const w = world(undefined, [rate]);
    const spec = pairAfterAx();
    if (spec.kind !== 'pair') throw new Error('A pair was expected.');
    const saved = await w.service.insertFields(ADMIN, { spec: { ...spec, cost: { ...spec.cost, formula } }, baseVersion: 1 });
    expect(saved.version).toBe(2);
    expect(w.audit.audit.committed).toHaveLength(1);
    expect(JSON.stringify(w.audit.audit.committed[0]?.after)).toContain(formula);
  });
});

describe('AC-9: one audit entry per save, in the same transaction', () => {
  it('records config.field_inserted about the new field, with who, the new column, what moved and the version', async () => {
    const w = world();
    await w.service.insertFields(ADMIN, { spec: inputAfterAx(), baseVersion: 1 });
    const [entry, ...others] = w.audit.audit.committed;
    expect(others).toEqual([]);
    expect(entry).toMatchObject({ event: 'config.field_inserted', actorId: ADMIN.user.id, actorLabel: 'Invented Admin', objectType: 'field', objectLabel: 'AY Invented Notch Count', before: null });
    expect(entry?.after).toMatchObject({ version: 2, fields: [{ letter: 'AY', label: 'Invented Notch Count', kind: 'input', follows: 'AX', formula: null }], moved: [{ from: 'AY', to: 'BO', by: 1 }] });
  });

  it('keeps the formula typed for the cost column of a pair, and one entry for the two fields', async () => {
    const w = world();
    await w.service.insertFields(ADMIN, { spec: pairAfterAx(), baseVersion: 1 });
    expect(w.audit.audit.committed).toHaveLength(1);
    expect(w.audit.audit.committed[0]?.after).toMatchObject({ fields: [{ letter: 'AY' }, { letter: 'AZ', kind: 'output', formula: 'AY * 2' }], moved: [{ from: 'AY', to: 'BO', by: 2 }] });
  });

  it('writes no entry for a refusal and none for a preview', async () => {
    const w = world();
    await w.service.previewInsert(ADMIN, { spec: inputAfterAx() });
    await rejection(w.service.insertFields(ADMIN, { spec: inputAfterAx({ label: '' }), baseVersion: 1 }));
    expect(w.audit.audit.committed).toEqual([]);
    expect(w.audit.audit.appended).toEqual([]);
  });
});
