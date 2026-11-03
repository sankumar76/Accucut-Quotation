import { describe, expect, it } from 'vitest';

import {
  autoFieldSchema,
  inputFieldSchema,
  outputFieldSchema,
  sectionSchema,
  stageSchema,
} from '@/lib/fields/field-schema';
import { configDocumentSchema, parseConfigDocument } from '@/lib/fields/schema';

import { cloneSeedConfig, seedFieldAt } from '../../support/seed-config';

/**
 * QLT-01 and architecture ruling R2: a stored version is immutable and `getCurrentVersion` validates it on
 * every read, so a schema may only ever grow in a way that version 1 still parses. A property added after
 * version 1 must parse when it is absent (`.optional()` or `.default(...)`).
 *
 * If one of the lists below fails, you added a REQUIRED key to a stored shape. Do not edit the list. Make the
 * new key optional (absent means the old behaviour) so every stored version stays readable.
 */

interface ShapeOwner {
  readonly shape: Readonly<Record<string, { safeParse(input: unknown): { success: boolean } }>>;
}

/** Keys whose schema refuses `undefined`, that is, the keys a stored document must hold. */
function requiredKeys(schema: ShapeOwner): string[] {
  return Object.entries(schema.shape)
    .filter(([, valueSchema]) => !valueSchema.safeParse(undefined).success)
    .map(([key]) => key)
    .sort();
}

const SHARED_KEYS = [
  'displayUnit', 'engineerVisible', 'formOrder', 'group', 'hint', 'id', 'key', 'kind', 'label', 'mandatory',
  'numFmt', 'position', 'rowScope', 'sectionId', 'stageId', 'systemRole', 'unit', 'width',
];

describe('stored versions stay readable: required keys are frozen at version 1 (QLT-01)', () => {
  it('an input field requires exactly the version 1 keys', () => {
    expect(requiredKeys(inputFieldSchema)).toEqual([...SHARED_KEYS, 'dataType', 'defaultValue', 'options', 'visibleWhen'].sort());
  });

  it('an auto field requires exactly the version 1 keys', () => {
    expect(requiredKeys(autoFieldSchema)).toEqual([...SHARED_KEYS, 'dataType'].sort());
  });

  it('an output field requires exactly the version 1 keys', () => {
    expect(requiredKeys(outputFieldSchema)).toEqual([...SHARED_KEYS, 'dataType', 'formula', 'hideWhenZero'].sort());
  });

  it('a section requires exactly the version 1 keys', () => {
    expect(requiredKeys(sectionSchema)).toEqual(['displayMode', 'id', 'name', 'number', 'shortName']);
  });

  it('a stage requires exactly the version 1 keys', () => {
    expect(requiredKeys(stageSchema)).toEqual(['id', 'name', 'number', 'shortName', 'subHeadings', 'totalFieldIds']);
  });

  it('the document requires exactly sections, stages and fields', () => {
    expect(requiredKeys(configDocumentSchema)).toEqual(['fields', 'sections', 'stages']);
  });

  it('the guard itself works: it would see a key whose schema refuses undefined', () => {
    const owner: ShapeOwner = {
      shape: {
        optionalKey: { safeParse: () => ({ success: true }) },
        requiredKey: { safeParse: (input) => ({ success: input !== undefined }) },
      },
    };
    expect(requiredKeys(owner)).toEqual(['requiredKey']);
  });
});

describe('multiline (architecture ruling R2)', () => {
  it('is not a required key, so a document stored before it existed still parses', () => {
    expect(requiredKeys(inputFieldSchema)).not.toContain('multiline');
    const document = cloneSeedConfig();
    const remarks = document.fields.find((field) => field.key === 'remarks');
    if (remarks === undefined) throw new Error('no remarks field');
    expect('multiline' in remarks).toBe(true);
    Reflect.deleteProperty(remarks, 'multiline');
    expect(() => parseConfigDocument(document)).not.toThrow();
  });

  it('is set on Remarks (AJ) and on no other seed field', () => {
    const document = cloneSeedConfig();
    const flagged = document.fields.filter((field) => field.kind === 'input' && field.multiline === true).map((field) => field.key);
    expect(flagged).toEqual(['remarks']);
    const remarks = seedFieldAt('AJ');
    expect(remarks.kind === 'input' && remarks.dataType === 'text' && remarks.mandatory).toBe(true);
  });

  it.each([true, false])('is accepted as %s on a text input', (value) => {
    const document = cloneSeedConfig();
    const description = document.fields.find((field) => field.key === 'description');
    if (description === undefined || description.kind !== 'input') throw new Error('no description field');
    description.multiline = value;
    expect(() => parseConfigDocument(document)).not.toThrow();
  });

  it.each([
    ['a number input', 'length'],
    ['a flag input', 'primer'],
    ['an image input', 'part-model'],
    ['a select input', 'material-in-drawing'],
  ])('is refused on %s', (_name, key) => {
    const document = cloneSeedConfig();
    const field = document.fields.find((candidate) => candidate.key === key);
    if (field === undefined || field.kind !== 'input') throw new Error(`no input ${key}`);
    field.multiline = true;
    expect(() => parseConfigDocument(document)).toThrow(/multiline is allowed only on a text input/);
  });

  it.each([
    ['an auto field', 'material-considered'],
    ['an output field', 'material-cost'],
  ])('is refused on %s (the property does not exist there)', (_name, key) => {
    const document = cloneSeedConfig();
    const field = document.fields.find((candidate) => candidate.key === key);
    if (field === undefined) throw new Error(`no field ${key}`);
    Object.assign(field, { multiline: true });
    expect(() => parseConfigDocument(document)).toThrow();
  });

  it('must be a boolean', () => {
    const document = cloneSeedConfig();
    const remarks = document.fields.find((field) => field.key === 'remarks');
    if (remarks === undefined) throw new Error('no remarks field');
    Object.assign(remarks, { multiline: 'yes' });
    expect(() => parseConfigDocument(document)).toThrow();
  });
});
