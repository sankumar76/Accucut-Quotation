import { describe, expect, it } from 'vitest';

import { isAppError } from '@/lib/errors';
import { ConfigDocumentError, configDocumentSchema, parseConfigDocument, type ConfigDocument } from '@/lib/fields/schema';

import { cloneSeedConfig, seedFieldAt } from '../../support/seed-config';
import { defined } from '../../support/defined';

/**
 * AC-6 (negative) and AC-2/AC-3 rules: a document that fails the schema is refused whole, with a message that
 * names the path and the rule and never a value. The input is a copy of the seed with one fault planted.
 */

type Loose = Record<string, unknown>;

/** A copy of the seed document as plain data, so a test can plant any fault, including an invalid one. */
function plain(): { sections: Loose[]; stages: Loose[]; fields: Loose[] } {
  return JSON.parse(JSON.stringify(cloneSeedConfig()));
}

function fieldOf(document: { fields: Loose[] }, letter: string): Loose {
  const target = seedFieldAt(letter);
  const found = document.fields.find((field) => field['id'] === target.id);
  if (found === undefined) throw new Error(`no field ${letter}`);
  return found;
}

function problems(document: unknown): string[] {
  const result = configDocumentSchema.safeParse(document);
  return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
}

describe('configuration document schema: faults are refused (AC-6)', () => {
  it('AC-6: the untouched copy is valid', () => {
    expect(problems(plain())).toEqual([]);
  });

  it('AC-6: refuses an unknown kind', () => {
    const document = plain();
    fieldOf(document, 'B')['kind'] = 'calculated';
    expect(problems(document)).not.toEqual([]);
  });

  it('AC-6: refuses a duplicate key', () => {
    const document = plain();
    fieldOf(document, 'C')['key'] = fieldOf(document, 'B')['key'];
    expect(problems(document)).toContain('fields.2.key: Two fields have the same key.');
  });

  it('AC-6: refuses a duplicate id', () => {
    const document = plain();
    fieldOf(document, 'C')['id'] = fieldOf(document, 'B')['id'];
    expect(problems(document).some((message) => message.endsWith('Two fields have the same id.'))).toBe(true);
  });

  it.each(['M', 'AK', 'BG', 'BL', 'BO', 'BH', 'BI', 'I', 'A'])('AC-6: refuses engineerVisible on %s', (letter) => {
    const document = plain();
    fieldOf(document, letter)['engineerVisible'] = true;
    expect(problems(document).some((message) => message.endsWith('engineerVisible is allowed only on input fields and on Material Considered.'))).toBe(true);
  });

  it('AC-6: allows engineerVisible on Material Considered (F) and on an input', () => {
    const document = plain();
    expect(fieldOf(document, 'F')['engineerVisible']).toBe(true);
    expect(problems(document)).toEqual([]);
  });

  it('AC-2: refuses a letter property on a field, on a section or at the top', () => {
    const onField = plain();
    fieldOf(onField, 'B')['letter'] = 'B';
    expect(problems(onField).some((message) => message.includes('letter'))).toBe(true);
    const onSection = plain();
    defined(onSection.sections[0])['letter'] = 'A';
    expect(problems(onSection)).not.toEqual([]);
    expect(problems({ ...plain(), letters: ['A'] })).not.toEqual([]);
  });

  it('AC-2: refuses a position that is not the place in the list', () => {
    const document = plain();
    fieldOf(document, 'C')['position'] = 9;
    expect(problems(document)).toContain('fields.2.position: Position must be 3: positions run 1 to N in list order.');
  });

  it('refuses a field whose section, stage or group does not exist', () => {
    const document = plain();
    fieldOf(document, 'B')['sectionId'] = '00000000-0000-4000-8000-00aa00000000';
    fieldOf(document, 'M')['stageId'] = '00000000-0000-4000-8000-00bb00000000';
    fieldOf(document, 'AL')['group'] = 'Nowhere';
    const found = problems(document);
    expect(found.some((message) => message.endsWith('sectionId names no section.'))).toBe(true);
    expect(found.some((message) => message.endsWith('stageId names no stage.'))).toBe(true);
    expect(found.some((message) => message.includes('group must be one of the sub-headings'))).toBe(true);
  });

  it('refuses a group on a field with no stage', () => {
    const document = plain();
    fieldOf(document, 'B')['group'] = 'Cutting';
    expect(problems(document).some((message) => message.includes('group must be one of the sub-headings'))).toBe(true);
  });

  it('refuses hideWhenZero, visibleWhen and stage totals that name no field, or the field itself', () => {
    const document = plain();
    fieldOf(document, 'AQ')['hideWhenZero'] = '00000000-0000-4000-8000-00cc00000000';
    fieldOf(document, 'AR')['hideWhenZero'] = fieldOf(document, 'AR')['id'];
    fieldOf(document, 'T')['visibleWhen'] = { fieldId: '00000000-0000-4000-8000-00cc00000000', operator: 'not-in', values: [''] };
    fieldOf(document, 'U')['visibleWhen'] = { fieldId: fieldOf(document, 'U')['id'], operator: 'not-in', values: [''] };
    defined(document.stages[0])['totalFieldIds'] = ['00000000-0000-4000-8000-00cc00000000'];
    const found = problems(document);
    expect(found.filter((message) => message.endsWith('hideWhenZero must name another field of the registry.'))).toHaveLength(2);
    expect(found.filter((message) => message.endsWith('visibleWhen must name another field of the registry.'))).toHaveLength(2);
    expect(found.some((message) => message.endsWith('A stage total names a field that is not in the registry.'))).toBe(true);
  });

  it('refuses the product scope on an input', () => {
    const document = plain();
    fieldOf(document, 'B')['rowScope'] = 'product';
    expect(problems(document).some((message) => message.endsWith('Only an output can have the product scope.'))).toBe(true);
  });

  it('refuses unique-number clashes in sections, stages and form order', () => {
    const document = plain();
    defined(document.sections[1])['number'] = 1;
    defined(document.stages[1])['number'] = 1;
    fieldOf(document, 'C')['formOrder'] = 1;
    const found = problems(document);
    expect(found.some((message) => message.startsWith('sections.1.number'))).toBe(true);
    expect(found.some((message) => message.startsWith('stages.1.number'))).toBe(true);
    expect(found.some((message) => message.includes('formOrder'))).toBe(true);
  });

  it('refuses a property that belongs to another kind (a formula on an input)', () => {
    const document = plain();
    fieldOf(document, 'B')['formula'] = '0';
    expect(problems(document)).not.toEqual([]);
  });

  it('refuses a data type the kind cannot have (a flag output, a number auto field)', () => {
    const output = plain();
    fieldOf(output, 'AK')['dataType'] = 'flag';
    expect(problems(output)).not.toEqual([]);
    const auto = plain();
    fieldOf(auto, 'F')['dataType'] = 'number';
    expect(problems(auto)).not.toEqual([]);
  });

  it('refuses a key that is not lower-case words joined by hyphens', () => {
    const document = plain();
    fieldOf(document, 'B')['key'] = 'Part No.';
    expect(problems(document)).not.toEqual([]);
  });

  it('refuses a document with no field, no section, or an unknown top-level property', () => {
    expect(problems({ ...plain(), fields: [] })).not.toEqual([]);
    expect(problems({ ...plain(), sections: [] })).not.toEqual([]);
    expect(problems({ ...plain(), extra: 1 })).not.toEqual([]);
    expect(problems(null)).not.toEqual([]);
  });
});

describe('configuration document schema: formulas and system roles', () => {
  it('refuses a formula that refers to a field that is not in the registry', () => {
    const document = plain();
    fieldOf(document, 'AI')['formula'] = '{{f:00000000-0000-4000-8000-00dd00000000}} / 144';
    expect(problems(document).some((message) => message.endsWith('A formula refers to a field that is not in the registry.'))).toBe(true);
  });

  it('refuses a formula with an unknown material key, an unknown currency, a bad rate id or a stray brace', () => {
    const document = plain();
    fieldOf(document, 'AI')['formula'] = '{{mat:density}}';
    fieldOf(document, 'AH')['formula'] = '{{fx:JPY}}';
    fieldOf(document, 'AK')['formula'] = '{{rate:Cutting-Rate-per-Sec}}';
    fieldOf(document, 'M')['formula'] = '{{f:oops';
    const found = problems(document);
    expect(found.some((message) => message.endsWith('A formula refers to a material value that does not exist.'))).toBe(true);
    expect(found.some((message) => message.endsWith('A formula refers to an exchange rate that does not exist.'))).toBe(true);
    expect(found.some((message) => message.endsWith('A formula holds a rate reference that is not an ID.'))).toBe(true);
    expect(found.some((message) => message.includes('not {{f:..}}'))).toBe(true);
  });

  it('refuses a formula on the Approved Quote Price: it has no editable formula', () => {
    const document = plain();
    fieldOf(document, 'BO')['formula'] = '0';
    expect(problems(document).some((message) => message.endsWith('The approved price is entered at approval and has no formula.'))).toBe(true);
  });

  it('refuses a document in which a system field is missing, doubled, or of the wrong kind', () => {
    const missing = plain();
    fieldOf(missing, 'BM')['systemRole'] = null;
    expect(problems(missing)).toContain('fields: The tool-cost role must belong to exactly one field (found 0).');
    const doubled = plain();
    fieldOf(doubled, 'BK')['systemRole'] = 'unit-price';
    expect(problems(doubled)).toContain('fields: The unit-price role must belong to exactly one field (found 2).');
    const wrongKind = plain();
    fieldOf(wrongKind, 'B')['systemRole'] = 'unit-price';
    expect(problems(wrongKind).some((message) => message.includes('The unit-price role belongs to a output field.'))).toBe(true);
  });
});

describe('parseConfigDocument (AC-6)', () => {
  it('returns the typed document when it is valid', () => {
    const document: ConfigDocument = parseConfigDocument(plain());
    expect(document.fields).toHaveLength(67);
  });

  it('throws a typed validation error that lists paths and rules and no value', () => {
    const document = plain();
    fieldOf(document, 'AK')['engineerVisible'] = true;
    fieldOf(document, 'AK')['formula'] = 'SECRET-LOOKING-TEXT';
    let thrown: unknown;
    try {
      parseConfigDocument(document);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(ConfigDocumentError);
    expect(isAppError(thrown)).toBe(true);
    expect(thrown).toMatchObject({ code: 'CONFIG_DOCUMENT_INVALID', httpStatus: 422 });
    const message = (thrown as ConfigDocumentError).message;
    expect(message).toContain('fields.');
    expect(message).not.toContain('SECRET-LOOKING-TEXT');
  });

  it('counts the problems it does not list', () => {
    const document = plain();
    for (const field of document.fields) field['position'] = 1;
    let thrown: unknown;
    try {
      parseConfigDocument(document);
    } catch (error) {
      thrown = error;
    }
    expect((thrown as ConfigDocumentError).message).toMatch(/\(and \d+ more\)$/);
    expect((thrown as ConfigDocumentError).issues.length).toBeGreaterThan(5);
  });

  it('names a document that is not an object as the document itself', () => {
    expect(() => parseConfigDocument('nonsense')).toThrow(/\(document\)/);
  });
});
