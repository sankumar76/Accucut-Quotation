import { describe, expect, it } from 'vitest';

import { columnLetterToIndex } from '@/lib/columns';
import { parseConfigDocument, type ConfigDocument } from '@/lib/fields/schema';
import type { ConfigRepository, ConfigVersionRecord, ConfigVersionUse } from '@/server/repositories/config-repository';
import { createConfigVersionCache } from '@/server/services/config-service';
import { createConfigReadService, type ConfigFieldRow } from '@/server/services/config-read-service';

import { defined } from '../support/defined';
import { cloneSeedConfig, seedConfig, SEED_PROCESS_ITEMS } from '../support/seed-config';

/**
 * STORY-08.01 AC-1 to AC-3 and AC-6 at the service: the rows of SCR-17 in column order, the system tags, the formulas in display form, and the version
 * line. A fake repository holds the one stored version and counts what is read. Every name is invented.
 */

const VERSION_ID = '00000000-0000-4000-8000-0ccc00000001';
const SAVED_AT = new Date('2026-11-10T04:30:00.000Z');
const INVENTED_ADMIN = 'Invented Admin';

function recordFor(document: ConfigDocument, number = 1, createdBy: string | null = null): ConfigVersionRecord {
  return { id: `${VERSION_ID.slice(0, -2)}${String(number).padStart(2, '0')}`, number, snapshot: document, createdBy, reason: 'Invented reason', createdAt: SAVED_AT };
}

interface FakeConfigurations extends ConfigRepository {
  readonly uses: string[];
}

function fakeConfigurations(records: ReadonlyArray<ConfigVersionRecord>, use: ConfigVersionUse): FakeConfigurations {
  const uses: string[] = [];
  return {
    uses,
    insertSeedVersionIfNone: () => Promise.resolve(false),
    findLatestRef() {
      const latest = records.reduce<ConfigVersionRecord | undefined>((best, row) => (best === undefined || row.number > best.number ? row : best), undefined);
      return Promise.resolve(latest === undefined ? null : { id: latest.id, number: latest.number });
    },
    findById: (id) => Promise.resolve(records.find((row) => row.id === id) ?? null),
    readVersionUse(id) {
      uses.push(id);
      return Promise.resolve(use);
    },
  };
}

const masters = { listProcessItems: () => Promise.resolve(SEED_PROCESS_ITEMS.map((item) => ({ ...item, defaultValue: '0.00' }))) };

function serviceOver(document: ConfigDocument = seedConfig, use: ConfigVersionUse = { savedByName: null, estimatesInUse: 0 }, createdBy: string | null = null) {
  const configurations = fakeConfigurations([recordFor(document, 1, createdBy)], use);
  return { configurations, service: createConfigReadService({ configurations, masters, cache: createConfigVersionCache() }) };
}

const rowAt = (rows: ReadonlyArray<ConfigFieldRow>, letter: string): ConfigFieldRow => defined(rows.find((row) => row.letter === letter));

describe('AC-1: the list is the registry in column order', () => {
  it('has one row for every field, in position order, with the letter derived from the position', async () => {
    const { fields } = await serviceOver().service.getFields();
    expect(fields).toHaveLength(seedConfig.fields.length);
    expect(fields.map((row) => columnLetterToIndex(row.letter))).toEqual(seedConfig.fields.map((_field, index) => index + 1));
    expect(fields.map((row) => row.id)).toEqual(seedConfig.fields.map((field) => field.id));
    expect(fields.map((row) => row.label)).toEqual(seedConfig.fields.map((field) => field.label));
  });

  it('says Input, Auto or Output for every field, with Excel columns BH and BI as outputs', async () => {
    const { fields } = await serviceOver().service.getFields();
    expect(new Set(fields.map((row) => row.kind))).toEqual(new Set(['input', 'auto', 'output']));
    expect(rowAt(fields, 'BH').kind).toBe('output');
    expect(rowAt(fields, 'BI').kind).toBe('output');
    expect(rowAt(fields, 'F').kind).toBe('auto');
  });

  it('names the section of an input and the stage of an output as "Section or stage"', async () => {
    const { fields } = await serviceOver().service.getFields();
    expect(rowAt(fields, 'E').place).toBe('Section 2: Material and Dimensions');
    expect(rowAt(fields, 'AL').place).toBe('Stage 3: Process Costs');
    expect(rowAt(fields, 'BL').place).toBe('Stage 6: Pricing');
  });

  it('shows a formula in display form: letters and names, never the stored references', async () => {
    const { fields } = await serviceOver().service.getFields();
    const text = JSON.stringify(fields);
    expect(text).not.toContain('{{');
    expect(rowAt(fields, 'AL').formula).toBe('P * Cutting-Rate-per-Sec');
    expect(rowAt(fields, 'AY').formula).toBe('AL + AM + AN + AO + AP + AQ + AR + AS + AT + AU + AV + AW + AX');
    expect(fields.some((row) => row.formula?.includes('ExchangeRate-USD') === true)).toBe(true);
  });

  it('shows no formula for a field that has none: every input and auto field, and the Approved Quote Price', async () => {
    const { fields } = await serviceOver().service.getFields();
    for (const row of fields.filter((candidate) => candidate.kind !== 'output')) expect(row.formula, row.letter).toBeNull();
    expect(rowAt(fields, 'BO').formula).toBeNull();
    expect(fields.filter((row) => row.formula !== null)).toHaveLength(31);
  });

  it('follows a re-lettering: with a field inserted before AL, every later letter and every letter in a formula is one further on', async () => {
    const before = columnLetterToIndex('AK');
    const copied = defined(seedConfig.fields.find((field) => field.position === columnLetterToIndex('Y')));
    const inserted = {
      ...copied,
      id: '00000000-0000-4000-8000-00ff00000001',
      key: 'invented-inserted-field',
      label: 'Invented inserted field',
      position: before + 1,
      formOrder: null,
      systemRole: null,
    };
    const fields = [
      ...seedConfig.fields.filter((field) => field.position <= before),
      inserted,
      ...seedConfig.fields.filter((field) => field.position > before).map((field) => ({ ...field, position: field.position + 1 })),
    ];
    const document = parseConfigDocument({ ...cloneSeedConfig(), fields });
    const rows = (await serviceOver(document).service.getFields()).fields;
    expect(rowAt(rows, 'AL').label).toBe('Invented inserted field');
    expect(rowAt(rows, 'AM').formula).toBe('P * Cutting-Rate-per-Sec');
    // Total Process Cost was AY and is AZ now, and it adds the same columns, each one letter further on.
    expect(rowAt(rows, 'AZ').formula).toBe('AM + AN + AO + AP + AQ + AR + AS + AT + AU + AV + AW + AX + AY');
  });
});

describe('AC-2: system fields are tagged, and a formula is offered only where there is one', () => {
  it('tags A, H, BG, BL, BM and BO as System, and no other field', async () => {
    const { fields } = await serviceOver().service.getFields();
    expect(fields.filter((row) => row.systemRole !== null).map((row) => row.letter)).toEqual(['A', 'H', 'BG', 'BL', 'BM', 'BO']);
    expect(rowAt(fields, 'BM').systemRole).toBe('tool-cost');
  });

  it('does not offer Edit formula on A, F, I and BO, which have no formula to edit', async () => {
    const { fields } = await serviceOver().service.getFields();
    for (const letter of ['A', 'F', 'I', 'BO']) expect(rowAt(fields, letter).canEditFormula, letter).toBe(false);
  });

  it('offers Edit formula on every output that has a formula, system ones included, BL and BG too', async () => {
    const { fields } = await serviceOver().service.getFields();
    expect(fields.filter((row) => row.canEditFormula)).toHaveLength(31);
    expect(rowAt(fields, 'BL').canEditFormula).toBe(true);
    expect(rowAt(fields, 'AL').canEditFormula).toBe(true);
  });
});

describe('AC-3: Scrap Weight and the estimate total', () => {
  it('lists O with its seeded formula and BL as SUM(BG)', async () => {
    const { fields } = await serviceOver().service.getFields();
    expect(rowAt(fields, 'O').formula).toBe('IF(Material-Specific-Gravity > 0, M - N, 0)');
    expect(rowAt(fields, 'BL').formula).toBe('SUM(BG)');
    expect(rowAt(fields, 'BL').systemRole).toBe('total');
  });

  it('prints the sentence of UX-09 under BL, and under no other field, with the letter of the per-row price taken from the registry', async () => {
    const { fields } = await serviceOver().service.getFields();
    expect(rowAt(fields, 'BL').note).toBe(
      "The estimate total is the sum of every row's BG. Each row's count is typed for the whole order, so nothing is multiplied by the rows above.",
    );
    expect(fields.filter((row) => row.note !== null).map((row) => row.letter)).toEqual(['BL']);
  });

  it('follows a re-lettering in the sentence too: with a field inserted before BG, it names BH', async () => {
    const before = columnLetterToIndex('BF');
    const copied = defined(seedConfig.fields.find((field) => field.position === columnLetterToIndex('Y')));
    const inserted = { ...copied, id: '00000000-0000-4000-8000-00ff00000002', key: 'invented-inserted-before-price', label: 'Invented inserted', position: before + 1, formOrder: null, systemRole: null };
    const fields = [
      ...seedConfig.fields.filter((field) => field.position <= before),
      inserted,
      ...seedConfig.fields.filter((field) => field.position > before).map((field) => ({ ...field, position: field.position + 1 })),
    ];
    const rows = (await serviceOver(parseConfigDocument({ ...cloneSeedConfig(), fields })).service.getFields()).fields;
    expect(rowAt(rows, 'BM').systemRole).toBe('total');
    expect(rowAt(rows, 'BM').note).toContain("sum of every row's BH.");
    expect(rowAt(rows, 'BM').formula).toBe('SUM(BH)');
  });
});

describe('AC-6: the current version', () => {
  it('gives the number, who saved it, when, and how many estimates use it', async () => {
    const { service, configurations } = serviceOver(seedConfig, { savedByName: INVENTED_ADMIN, estimatesInUse: 3 }, 'c0ffee00-0000-4000-8000-000000000001');
    expect(await service.getCurrent()).toEqual({ number: 1, savedBy: INVENTED_ADMIN, savedAt: SAVED_AT.toISOString(), estimatesInUse: 3 });
    expect(configurations.uses).toEqual([recordFor(seedConfig).id]);
  });

  it('says nobody saved the seed version, and counts no estimate while none was calculated', async () => {
    expect(await serviceOver().service.getCurrent()).toEqual({ number: 1, savedBy: null, savedAt: SAVED_AT.toISOString(), estimatesInUse: 0 });
  });
});

describe('a list that cannot be read', () => {
  it('fails when a formula names a rate that the Process Master no longer has, and says so without printing the formula', async () => {
    const configurations = fakeConfigurations([recordFor(seedConfig)], { savedByName: null, estimatesInUse: 0 });
    const service = createConfigReadService({ configurations, masters: { listProcessItems: () => Promise.resolve([]) }, cache: createConfigVersionCache() });
    const error = await service.getFields().then(
      () => null,
      (thrown: unknown) => thrown,
    );
    expect(error).toBeInstanceOf(Error);
    expect(error instanceof Error ? error.message : '').not.toContain('Cutting-Rate');
  });
});
