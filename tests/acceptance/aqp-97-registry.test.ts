import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { SEED_PROCESS_ITEMS, cloneSeedConfig, seedConfig } from '../support/seed-config';
import { defined } from '../support/defined';
import { ConfigDocumentError, parseConfigDocument, type ConfigDocument } from '../../src/lib/fields/schema';
import {
  describeVisibleWhen,
  fieldLetter,
  fieldsInFormOrder,
  findFieldById,
  findFieldByKey,
  findSystemField,
  sectionColumnRange,
} from '../../src/lib/fields/registry';
import { engineerVisibleFields, isFieldShown } from '../../src/lib/fields/visibility';

/**
 * QA acceptance tests for AQP-97 (STORY-03.01), AC-2 to AC-5 and AC-7: the seed field registry.
 *
 * The oracle is the SPEC itself. `ACCUCUT_QUOTATION_PORTAL_REQUIREMENTS.md` section 7.1 (inputs), 7.4
 * (outputs and stages) and 4.1 (the 15 Process Master names and units) are parsed here, and every seed
 * field is compared with its row. The letter of a position comes from an odometer written for this file
 * (A..Z, AA..), not from `src/lib/columns.ts`. Letters appear in this file because tests may write them.
 */

const SPEC_PATH = fileURLToPath(new URL('../../ACCUCUT_QUOTATION_PORTAL_REQUIREMENTS.md', import.meta.url));
const SPEC_LINES = readFileSync(SPEC_PATH, 'utf8').split(/\r?\n/);

// ---- An independent letter oracle ----------------------------------------------------------------------------

function nextLabel(label: string): string {
  const characters = label.split('');
  for (let index = characters.length - 1; index >= 0; index -= 1) {
    if (characters[index] !== 'Z') {
      characters[index] = String.fromCharCode((characters[index] ?? 'A').charCodeAt(0) + 1);
      return characters.join('');
    }
    characters[index] = 'A';
  }
  return `A${characters.join('')}`;
}

const LABELS: string[] = [];
for (let label = 'A'; LABELS.length < 200; label = nextLabel(label)) LABELS.push(label);

function positionOf(letter: string): number {
  const index = LABELS.indexOf(letter);
  if (index < 0) throw new Error(`Unknown column ${letter}.`);
  return index + 1;
}

function letterOf(position: number): string {
  return defined(LABELS[position - 1], `letter of position ${position}`);
}

/** The stored formula of the output at a letter (null for the Approved Quote Price). */
function formulaAt(letter: string): string | null {
  const field = seedFieldAt(letter);
  if (field.kind !== 'output') throw new Error(`${letter} is not an output.`);
  return field.formula;
}

function seedFieldAt(letter: string) {
  return defined(seedConfig.fields[positionOf(letter) - 1], `field at ${letter}`);
}

// ---- Parsing the SPEC -------------------------------------------------------------------------------------------

function section(from: string, to: string): string[] {
  const start = SPEC_LINES.findIndex((line) => line.startsWith(from));
  const end = SPEC_LINES.findIndex((line, index) => index > start && line.startsWith(to));
  if (start < 0 || end < 0) throw new Error(`The SPEC has no part from "${from}" to "${to}".`);
  return SPEC_LINES.slice(start + 1, end);
}

function cellsOf(line: string): string[] | undefined {
  if (!line.startsWith('|')) return undefined;
  const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
  return cells.every((cell) => /^:?-+:?$/.test(cell)) ? undefined : cells;
}

function plain(text: string): string {
  return text.replace(/\*\*/g, '').replace(/`/g, '').trim();
}

interface SpecInput {
  readonly letter: string;
  readonly section: number;
  readonly sectionName: string;
  readonly label: string;
  readonly type: string;
}

function specInputs(): SpecInput[] {
  const rows: SpecInput[] = [];
  let current = { number: 0, name: '' };
  for (const line of section('### 7.1', '### 7.2')) {
    const cells = cellsOf(line);
    if (cells === undefined || cells.length < 6) continue;
    const [number = '', name = '', letter = '', label = '', type = ''] = cells;
    if (/^\d+$/.test(number)) current = { number: Number(number), name: plain(name) };
    if (!/^[A-Z]{1,2}$/.test(letter)) continue;
    rows.push({ letter, section: current.number, sectionName: current.name, label: plain(label), type: plain(type) });
  }
  return rows;
}

interface SpecOutput {
  readonly letter: string;
  readonly label: string;
  readonly formula: string | undefined;
  readonly stage: number;
  readonly stageName: string;
  readonly group: string | null;
}

interface SpecDirectEntry {
  readonly letters: string[];
  readonly stage: number;
  readonly group: string | null;
}

function specOutputs(): { outputs: SpecOutput[]; direct: SpecDirectEntry[] } {
  const outputs: SpecOutput[] = [];
  const direct: SpecDirectEntry[] = [];
  let stage = 0;
  let stageName = '';
  let group: string | null = null;
  for (const line of section('### 7.4', '**Percent rates')) {
    const cells = cellsOf(line);
    if (cells === undefined || cells.length < 4) continue;
    const [first = '', letterCell = '', label = '', ...rest] = cells;
    if (first !== '') {
      const stageMatch = /^(\d) · (.+)$/.exec(plain(first));
      if (stageMatch !== null) {
        stage = Number(stageMatch[1]);
        const [name = '', subHeading] = (stageMatch[2] ?? '').split(' — ');
        stageName = name;
        group = subHeading ?? null;
      } else {
        group = plain(first);
      }
    }
    if (/^[A-Z]{1,2}(, [A-Z]{1,2})+$/.test(letterCell)) {
      direct.push({ letters: letterCell.split(', '), stage, group });
      continue;
    }
    if (!/^[A-Z]{1,2}$/.test(letterCell)) continue;
    const formulaSpan = /`([^`]+)`/.exec(rest.join('|'));
    outputs.push({ letter: letterCell, label: plain(label), formula: formulaSpan?.[1], stage, stageName, group });
  }
  return { outputs, direct };
}

interface SpecRate {
  readonly name: string;
  readonly unit: string;
}

function specRates(): SpecRate[] {
  const rates: SpecRate[] = [];
  for (const line of section('### 4.1', '### 4.2')) {
    const cells = cellsOf(line);
    if (cells === undefined || cells.length !== 2) continue;
    const [name = '', unit = ''] = cells;
    if (name.startsWith('`') && !name.startsWith('`Rate name')) rates.push({ name: plain(name), unit });
  }
  return rates;
}

const INPUTS = specInputs();
const { outputs: OUTPUTS, direct: DIRECT } = specOutputs();

// ---- Display form, rebuilt from the stored text without the repository's converter ---------------------------

const MATERIAL_NAMES: Readonly<Record<string, string>> = {
  specificGravity: 'Material-Specific-Gravity',
  pricePerKg: 'Material-Price-per-kg',
  scrapRate: 'Material-Scrap-Rate',
};

function rebuildDisplay(internal: string): string {
  return internal.replace(/\{\{(f|rate|mat|fx):([^}]+)\}\}/g, (_whole, prefix: string, value: string) => {
    switch (prefix) {
      case 'f': {
        const field = defined(findFieldById(seedConfig, value), `field ${value}`);
        return defined(letterOf(field.position));
      }
      case 'rate':
        return defined(SEED_PROCESS_ITEMS.find((item) => item.id === value), `rate ${value}`).name;
      case 'mat':
        return defined(MATERIAL_NAMES[value], `material ${value}`);
      default:
        return `ExchangeRate-${value}`;
    }
  });
}

function squash(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

// ---- The parse itself is checked first, so a broken parser cannot make the comparisons pass ------------------

describe('[AQP-97 AC-2] the oracle: what the SPEC tables hold', () => {
  it('[AQP-97 AC-2] SPEC 7.1 lists 35 input and auto rows and 7.4 lists 32 output rows, 67 in all', () => {
    expect(INPUTS).toHaveLength(35);
    expect(OUTPUTS).toHaveLength(32);
    expect(new Set([...INPUTS, ...OUTPUTS].map((row) => row.letter)).size).toBe(67);
    expect([...INPUTS, ...OUTPUTS].map((row) => positionOf(row.letter)).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 67 }, (_unused, index) => index + 1),
    );
  });
});

// ---- AC-2 ---------------------------------------------------------------------------------------------------------

describe('[AQP-97 AC-2] the seed holds every SPEC 7.1 and 7.4 field, in order', () => {
  it('[AQP-97 AC-2] 67 fields: 35 inputs and auto fields, 32 outputs; positions 1 to 67 in list order', () => {
    expect(seedConfig.fields).toHaveLength(67);
    expect(seedConfig.fields.filter((field) => field.kind !== 'output')).toHaveLength(35);
    expect(seedConfig.fields.filter((field) => field.kind === 'output')).toHaveLength(32);
    expect(seedConfig.fields.filter((field) => field.kind === 'auto').map((field) => letterOf(field.position))).toEqual(['A', 'F', 'I']);
    expect(seedConfig.fields.map((field) => field.position)).toEqual(Array.from({ length: 67 }, (_unused, index) => index + 1));
  });

  it('[AQP-97 AC-2] every field sits at the position of its SPEC letter and carries its SPEC label', () => {
    for (const row of [...INPUTS, ...OUTPUTS]) {
      const field = seedFieldAt(row.letter);
      expect(field.label, `label of ${row.letter}`).toBe(row.label);
      expect(fieldLetter(field), `letter derived for ${row.letter}`).toBe(row.letter);
    }
  });

  it('[AQP-97 AC-2] kind and data type follow the SPEC type word', () => {
    for (const row of INPUTS) {
      const field = seedFieldAt(row.letter);
      switch (row.type) {
        case 'auto':
          expect(field.kind, row.letter).toBe('auto');
          expect(['text', 'auto_lookup'], row.letter).toContain(field.dataType);
          break;
        case 'text':
          expect([field.kind, field.dataType], row.letter).toEqual(['input', 'text']);
          break;
        case 'text (multiline)':
          expect([field.kind, field.dataType], row.letter).toEqual(['input', 'text']);
          expect(field.kind === 'input' ? field.multiline : undefined, row.letter).toBe(true);
          break;
        case 'image':
          expect([field.kind, field.dataType], row.letter).toEqual(['input', 'image']);
          break;
        case 'select':
          expect([field.kind, field.dataType], row.letter).toEqual(['input', 'select']);
          break;
        case 'select + other':
          expect([field.kind, field.dataType], row.letter).toEqual(['input', 'select_other']);
          break;
        case 'number(2dp)':
          expect([field.kind, field.dataType], row.letter).toEqual(['input', 'number']);
          break;
        case 'flag 1/0':
          expect([field.kind, field.dataType], row.letter).toEqual(['input', 'flag']);
          break;
        default:
          throw new Error(`The SPEC type "${row.type}" of ${row.letter} is not one this test knows.`);
      }
    }
    for (const row of OUTPUTS) {
      const field = seedFieldAt(row.letter);
      expect([field.kind, field.dataType], row.letter).toEqual(['output', 'number']);
    }
  });

  it('[AQP-97 AC-2] every field carries key, label, kind, data type, section or stage, position, width, number format, mandatory, defaultValue (inputs) and rowScope', () => {
    const keys = new Set<string>();
    for (const field of seedConfig.fields) {
      expect(field.key).toMatch(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);
      expect(keys.has(field.key), `duplicate key ${field.key}`).toBe(false);
      keys.add(field.key);
      expect(field.label.length).toBeGreaterThan(0);
      expect(field.width).toBeGreaterThan(0);
      expect(field.width).toBeLessThanOrEqual(255);
      expect(field.numFmt.length).toBeGreaterThan(0);
      expect(typeof field.mandatory).toBe('boolean');
      expect(['row', 'product']).toContain(field.rowScope);
      if (field.kind === 'input') {
        expect(field.defaultValue === null || typeof field.defaultValue === 'string').toBe(true);
        expect(field.sectionId, field.key).not.toBeNull();
      }
      if (field.kind === 'output') expect(field.stageId, field.key).not.toBeNull();
    }
  });

  it('[AQP-97 AC-2] mandatory follows SPEC 7.3: every input except Part Model (C) and the eight treatment flags', () => {
    for (const row of INPUTS) {
      const field = seedFieldAt(row.letter);
      const optional = row.letter === 'C' || row.type === 'flag 1/0';
      expect(field.mandatory, `mandatory of ${row.letter}`).toBe(row.type !== 'auto' && !optional);
    }
  });

  it('[AQP-97 AC-2] there is no letter property, and no key that names a letter or column, anywhere in the document', () => {
    const offending: string[] = [];
    const walk = (value: unknown, path: string): void => {
      if (Array.isArray(value)) {
        value.forEach((child, index) => walk(child, `${path}[${index}]`));
      } else if (typeof value === 'object' && value !== null) {
        for (const [key, child] of Object.entries(value)) {
          if (/letter|column|^col$/i.test(key)) offending.push(`${path}.${key}`);
          walk(child, `${path}.${key}`);
        }
      }
    };
    walk(JSON.parse(JSON.stringify(seedConfig)), 'document');
    expect(offending).toEqual([]);
  });

  it('[AQP-97 AC-2] the stored document contains no column letter as a value either (letters are derived, not stored)', () => {
    // Every string leaf that is exactly 1 to 3 capital letters would be a stored letter. Labels such as "CSK" are
    // the one allowed look-alike, so the check is on keys and on "letter-shaped" values outside label and hint.
    const stored: string[] = [];
    const walk = (value: unknown, key: string): void => {
      if (Array.isArray(value)) value.forEach((child) => walk(child, key));
      else if (typeof value === 'object' && value !== null) Object.entries(value).forEach(([childKey, child]) => walk(child, childKey));
      else if (typeof value === 'string' && !['label', 'name', 'shortName', 'hint', 'group'].includes(key) && /^[A-Z]{1,3}$/.test(value)) {
        stored.push(`${key}=${value}`);
      }
    };
    walk(JSON.parse(JSON.stringify(seedConfig)), 'document');
    expect(stored).toEqual([]);
  });

  it('[AQP-97 AC-2] a letter property is refused by the schema at the top, in a section, in a stage and in a field of every kind', () => {
    const plant = (change: (document: ConfigDocument) => void): void => {
      const document = cloneSeedConfig();
      change(document);
      expect(() => parseConfigDocument(document)).toThrow(ConfigDocumentError);
    };
    plant((document) => Object.assign(document, { letter: 'A' }));
    plant((document) => Object.assign(defined(document.sections[0]), { letter: 'A' }));
    plant((document) => Object.assign(defined(document.stages[0]), { letter: 'A' }));
    for (const letter of ['A', 'B', 'F', 'M', 'BO']) plant((document) => Object.assign(defined(document.fields[positionOf(letter) - 1]), { letter }));
    plant((document) => Object.assign(defined(document.fields[0]), { column: 'A' }));
  });
});

// ---- AC-3 ---------------------------------------------------------------------------------------------------------

describe('[AQP-97 AC-3] system roles, visibility and special field properties', () => {
  it('[AQP-97 AC-3] systemRole is set on A, H, BG, BL, BM and BO and on nothing else', () => {
    const roles = Object.fromEntries(
      seedConfig.fields.filter((field) => field.systemRole !== null).map((field) => [letterOf(field.position), [field.key, field.systemRole]]),
    );
    expect(roles).toEqual({
      A: ['sl-no', 'sl-no'],
      H: ['qty-per-assy', 'quantity'],
      BG: ['unit-price', 'unit-price'],
      BL: ['total-price', 'total'],
      BM: ['tool-cost', 'tool-cost'],
      BO: ['approved-price', 'approved-price'],
    });
    for (const role of ['sl-no', 'quantity', 'unit-price', 'total', 'tool-cost', 'approved-price'] as const) {
      expect(findSystemField(seedConfig, role)?.systemRole).toBe(role);
    }
  });

  it('[AQP-97 AC-3] engineerVisible is true for every input and for F, and for nothing else (not A, I, BH, BI, nor any output)', () => {
    const visible = seedConfig.fields.filter((field) => field.engineerVisible).map((field) => letterOf(field.position));
    const expected = [...INPUTS.filter((row) => row.type !== 'auto'), ...INPUTS.filter((row) => row.letter === 'F')]
      .map((row) => row.letter)
      .sort((a, b) => positionOf(a) - positionOf(b));
    expect(visible).toEqual(expected);
    expect(visible).toHaveLength(33);
    for (const letter of ['A', 'I', 'BH', 'BI']) expect(seedFieldAt(letter).engineerVisible, letter).toBe(false);
    expect(engineerVisibleFields(seedConfig.fields)).toHaveLength(33);
    expect(seedFieldAt('F').engineerVisible).toBe(true);
  });

  it('[AQP-97 AC-3] the schema refuses engineerVisible on every field that is not an input or F, one at a time (34 fields)', () => {
    const refused: string[] = [];
    for (const field of seedConfig.fields) {
      if (field.engineerVisible) continue;
      const document = cloneSeedConfig();
      defined(document.fields[field.position - 1]).engineerVisible = true;
      try {
        parseConfigDocument(document);
      } catch (error) {
        if (error instanceof ConfigDocumentError) refused.push(letterOf(field.position) ?? '?');
      }
    }
    const expectedRefused = seedConfig.fields.filter((field) => !field.engineerVisible).map((field) => letterOf(field.position));
    expect(expectedRefused).toHaveLength(34);
    expect(refused).toEqual(expectedRefused);
  });

  it('[AQP-97 AC-3] the schema accepts engineerVisible false on an input (a hidden input is allowed) and still refuses it on I, BH and BI by name', () => {
    const hidden = cloneSeedConfig();
    defined(hidden.fields[positionOf('J') - 1]).engineerVisible = false;
    expect(() => parseConfigDocument(hidden)).not.toThrow();
    for (const letter of ['I', 'BH', 'BI']) {
      const document = cloneSeedConfig();
      defined(document.fields[positionOf(letter) - 1]).engineerVisible = true;
      expect(() => parseConfigDocument(document), letter).toThrow(/engineerVisible is allowed only on input fields and on Material Considered/);
    }
  });

  it('[AQP-97 AC-3] Part Model (C) is optional; Fasteners (S) defaults to "None"; T and U are hidden while S is not-in [None, blank]', () => {
    expect(seedFieldAt('C').mandatory).toBe(false);
    const fasteners = seedFieldAt('S');
    expect(fasteners.kind === 'input' ? fasteners.defaultValue : undefined).toBe('None');
    for (const letter of ['T', 'U']) {
      const field = seedFieldAt(letter);
      expect(field.kind === 'input' ? field.visibleWhen : undefined, letter).toEqual({ fieldId: fasteners.id, operator: 'not-in', values: ['None', ''] });
      expect(describeVisibleWhen(seedConfig, field), letter).toBe("S not in ['None','']");
      expect(isFieldShown(field, () => 'None'), `${letter} when None`).toBe(false);
      expect(isFieldShown(field, () => ''), `${letter} when blank`).toBe(false);
      expect(isFieldShown(field, () => undefined), `${letter} when absent`).toBe(false);
      expect(isFieldShown(field, () => 'M6 bolt'), `${letter} when set`).toBe(true);
    }
    // No other field has a visibility rule.
    const withRule = seedConfig.fields.filter((field) => field.kind === 'input' && field.visibleWhen !== null).map((field) => letterOf(field.position));
    expect(withRule).toEqual(['T', 'U']);
  });

  it('[AQP-97 AC-3] each treatment cost output hides while its flag is 0: AQ-Z, AR-AA, AS-AB, AT-AC, AV-AE, AW-AF, AX-AG, and no other output has the property', () => {
    const pairs: ReadonlyArray<readonly [string, string]> = [
      ['AQ', 'Z'],
      ['AR', 'AA'],
      ['AS', 'AB'],
      ['AT', 'AC'],
      ['AV', 'AE'],
      ['AW', 'AF'],
      ['AX', 'AG'],
    ];
    for (const [cost, flag] of pairs) {
      const field = seedFieldAt(cost);
      expect(field.kind === 'output' ? field.hideWhenZero : undefined, cost).toBe(seedFieldAt(flag).id);
    }
    const withProperty = seedConfig.fields.filter((field) => field.kind === 'output' && field.hideWhenZero !== null).map((field) => letterOf(field.position));
    expect(withProperty).toEqual(pairs.map(([cost]) => cost));
    // The Plating flag (AD) hides nothing: no seed output uses it (D-40).
    expect(seedConfig.fields.filter((field) => field.kind === 'output' && field.hideWhenZero === seedFieldAt('AD').id)).toHaveLength(0);
  });

  it('[AQP-97 AC-3] section 08 is shown AP, AU, BM, AJ (form order), which is not letter order; other sections follow letter order, except where the SPEC says otherwise', () => {
    const eight = defined(seedConfig.sections[7]);
    const inForm = fieldsInFormOrder(seedConfig, eight).map((field) => letterOf(field.position));
    expect(inForm).toEqual(['AP', 'AU', 'BM', 'AJ']);
    expect(inForm).not.toEqual([...inForm].sort((a, b) => positionOf(a) - positionOf(b)));
    // The whole form: the SPEC 7.1 row order is the form order, section by section.
    for (const spec of seedConfig.sections) {
      const expected = INPUTS.filter((row) => row.section === spec.number).map((row) => row.letter);
      expect(fieldsInFormOrder(seedConfig, spec).map((field) => letterOf(field.position)), `section ${spec.number}`).toEqual(expected);
    }
  });

  it('[AQP-97 AC-3] BL, BN and BO have rowScope product and no other field does', () => {
    const product = seedConfig.fields.filter((field) => field.rowScope === 'product').map((field) => letterOf(field.position));
    expect(product).toEqual(['BL', 'BN', 'BO']);
  });

  it('[AQP-97 AC-3] system roles cannot be removed, doubled or moved to a field of the wrong kind', () => {
    const roleChange: ReadonlyArray<readonly [string, (document: ConfigDocument) => void]> = [
      ['a role removed', (document) => void (defined(document.fields[positionOf('BM') - 1]).systemRole = null)],
      ['a role doubled', (document) => void (defined(document.fields[positionOf('J') - 1]).systemRole = 'tool-cost')],
      ['quantity on an output', (document) => void (defined(document.fields[positionOf('M') - 1]).systemRole = 'quantity')],
      ['approved price with a formula', (document) => void Object.assign(defined(document.fields[positionOf('BO') - 1]), { formula: '0' })],
    ];
    for (const [name, change] of roleChange) {
      const document = cloneSeedConfig();
      change(document);
      expect(() => parseConfigDocument(document), name).toThrow(ConfigDocumentError);
    }
  });
});

// ---- AC-4 ---------------------------------------------------------------------------------------------------------

describe('[AQP-97 AC-4] sections and stages', () => {
  it('[AQP-97 AC-4] eight sections numbered 1 to 8 with the SPEC names; Surface Treatment is the one multi-select', () => {
    expect(seedConfig.sections).toHaveLength(8);
    const specSections = new Map(INPUTS.map((row) => [row.section, row.sectionName]));
    expect([...specSections.keys()]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const spec of seedConfig.sections) {
      expect(spec.name, `section ${spec.number}`).toBe(specSections.get(spec.number));
      expect(spec.shortName.length).toBeGreaterThan(0);
      expect(spec.displayMode).toBe(spec.number === 7 ? 'multi-select' : 'cards');
    }
    expect(seedConfig.sections.map((spec) => spec.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('[AQP-97 AC-4] each section\'s column range is derived from the letters the SPEC puts in it', () => {
    const expected: Record<number, string> = {
      1: 'A–D, G, H',
      2: 'E, F, I–L, N',
      3: 'P, Q',
      4: 'R',
      5: 'S–U',
      6: 'V–Y',
      7: 'Z–AG',
      8: 'AJ, AP, AU, BM',
    };
    for (const spec of seedConfig.sections) {
      expect(sectionColumnRange(seedConfig, spec), `section ${spec.number}`).toBe(expected[spec.number]);
      // And against the SPEC rows, with this file's own run-merging rule.
      const positions = INPUTS.filter((row) => row.section === spec.number).map((row) => positionOf(row.letter)).sort((a, b) => a - b);
      const parts: string[] = [];
      for (let index = 0; index < positions.length; ) {
        let end = index;
        while (positions[end + 1] === defined(positions[end]) + 1) end += 1;
        const run = positions.slice(index, end + 1).map((position) => defined(LABELS[position - 1]));
        parts.push(...(run.length >= 3 ? [`${run[0]}–${run[run.length - 1]}`] : run));
        index = end + 1;
      }
      expect(parts.join(', '), `section ${spec.number}`).toBe(expected[spec.number]);
    }
  });

  it('[AQP-97 AC-4] the range tag follows the fields shown: hiding F and I from an Engineer-style view changes section 2 only', () => {
    const two = defined(seedConfig.sections[1]);
    const withoutAuto = sectionColumnRange(seedConfig, two, (field) => field.kind === 'input');
    expect(withoutAuto).toBe('E, J–L, N');
  });

  it('[AQP-97 AC-4] six stages with the SPEC names, and the SPEC sub-headings of stage 3 in order', () => {
    expect(seedConfig.stages).toHaveLength(6);
    const specStages = new Map(OUTPUTS.map((row) => [row.stage, row.stageName]));
    expect([...specStages.keys()].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    for (const stage of seedConfig.stages) expect(stage.name, `stage ${stage.number}`).toBe(specStages.get(stage.number));
    expect(defined(seedConfig.stages[2]).subHeadings).toEqual(['Cutting', 'Bending', 'Welding', 'Surface Treatment', 'Entered directly', 'Process Total']);
    for (const index of [0, 1, 3, 4, 5]) expect(defined(seedConfig.stages[index]).subHeadings).toEqual([]);
  });

  it('[AQP-97 AC-4] every output is in the stage and sub-heading the SPEC puts it in; AP and AU are in stage 3 "Entered directly"', () => {
    for (const row of OUTPUTS) {
      const field = seedFieldAt(row.letter);
      const stage = seedConfig.stages.find((candidate) => candidate.id === field.stageId);
      expect(stage?.number, `stage of ${row.letter}`).toBe(row.stage);
      expect(field.group, `group of ${row.letter}`).toBe(row.group === null || row.stage !== 3 ? null : row.group);
    }
    expect(DIRECT).toHaveLength(1);
    for (const letter of defined(DIRECT[0]).letters) {
      const field = seedFieldAt(letter);
      expect(seedConfig.stages.find((candidate) => candidate.id === field.stageId)?.number, letter).toBe(3);
      expect(field.group, letter).toBe('Entered directly');
    }
  });

  it('[AQP-97 AC-4] stage totals: stage 3 is Total Process Cost (AY); stage 5 adds Rejection to Transportation (BC to BF); stage 1 has none', () => {
    const totals = seedConfig.stages.map((stage) => stage.totalFieldIds.map((id) => letterOf(defined(findFieldById(seedConfig, id)).position)));
    expect(totals[0]).toEqual([]);
    expect(totals[2]).toEqual(['AY']);
    expect(totals[4]).toEqual(['BC', 'BD', 'BE', 'BF']);
    expect(defined(findFieldByKey(seedConfig, 'total-process-cost')).position).toBe(positionOf('AY'));
    for (const stage of seedConfig.stages) {
      for (const id of stage.totalFieldIds) {
        const field = defined(findFieldById(seedConfig, id));
        expect(seedConfig.stages.find((candidate) => candidate.id === field.stageId)?.number, `total of stage ${stage.number}`).toBe(stage.number);
      }
    }
  });

  it('[AQP-97 AC-4] a stage total that names a field not in the registry is refused', () => {
    const document = cloneSeedConfig();
    defined(document.stages[2]).totalFieldIds = ['00000000-0000-4000-8000-00ff00000001'];
    expect(() => parseConfigDocument(document)).toThrow(/stage total names a field that is not in the registry/);
  });
});

// ---- AC-5 ---------------------------------------------------------------------------------------------------------

describe('[AQP-97 AC-5] formulas: stored with stable references, displayed back as the SPEC text', () => {
  it('[AQP-97 AC-5] every SPEC 7.4 formula is present and its display form is the SPEC text, rebuilt without the repository\'s converter', () => {
    const expectedFormula: Record<string, string | null> = { BH: 'ExchangeRate-USD', BI: 'ExchangeRate-EUR', BO: null };
    for (const row of OUTPUTS) {
      const field = seedFieldAt(row.letter);
      const stored = field.kind === 'output' ? field.formula : undefined;
      const specText = row.letter in expectedFormula ? expectedFormula[row.letter] : (row.formula ?? null);
      if (specText === null) {
        expect(stored, `formula of ${row.letter}`).toBeNull();
      } else {
        expect(squash(rebuildDisplay(defined(stored, `formula of ${row.letter}`))), `formula of ${row.letter}`).toBe(squash(defined(specText)));
      }
    }
  });

  it('[AQP-97 AC-5] 31 outputs have a formula, only BO (Approved Quote Price) has none', () => {
    const without = seedConfig.fields.filter((field) => field.kind === 'output' && field.formula === null).map((field) => letterOf(field.position));
    expect(without).toEqual(['BO']);
  });

  it('[AQP-97 AC-5] the stored text holds only {{f:..}}, {{rate:..}}, {{mat:..}} and {{fx:..}}: no column letter, rate name or material name is left in it', () => {
    const rateNames = SEED_PROCESS_ITEMS.map((item) => item.name);
    for (const field of seedConfig.fields) {
      if (field.kind !== 'output' || field.formula === null) continue;
      const rest = field.formula.replace(/\{\{(f|rate|mat|fx):[^}]+\}\}/g, '');
      const label = letterOf(field.position);
      expect(rest, `residue in ${label}`).not.toMatch(/\b[A-Z]{1,3}\b(?<!\bIF\b)(?<!\bSUM\b)/);
      for (const name of [...rateNames, ...Object.values(MATERIAL_NAMES), 'ExchangeRate']) expect(field.formula, label).not.toContain(name);
      expect(field.formula, `stored letters in ${label}`).not.toMatch(/\{\{f:[A-Z]/);
    }
  });

  it('[AQP-97 AC-5] Scrap Weight is IF(Material-Specific-Gravity > 0, M - N, 0); Rejection is 0; BL is SUM(BG); BN is BL / SUM(BM)', () => {
    expect(rebuildDisplay(defined(formulaAt('O')))).toBe('IF(Material-Specific-Gravity > 0, M - N, 0)');
    expect(formulaAt('BC')).toBe('0');
    expect(rebuildDisplay(defined(formulaAt('BL')))).toBe('SUM(BG)');
    expect(rebuildDisplay(defined(formulaAt('BN')))).toBe('BL / SUM(BM)');
    expect(rebuildDisplay(defined(formulaAt('BB')))).toBe('BA * H');
  });

  it('[AQP-97 AC-5] H (QTY per Assy) is an operand in BB and in no other formula', () => {
    const quantityId = seedFieldAt('H').id;
    const users = seedConfig.fields
      .filter((field) => field.kind === 'output' && field.formula !== null && field.formula.includes(`{{f:${quantityId}}}`))
      .map((field) => letterOf(field.position));
    expect(users).toEqual(['BB']);
  });

  it('[AQP-97 AC-5] the exchange rate fields hold {{fx:USD}} and {{fx:EUR}}; materials hold {{mat:..}} from the fixed set', () => {
    expect(formulaAt('BH')).toBe('{{fx:USD}}');
    expect(formulaAt('BI')).toBe('{{fx:EUR}}');
    const materialKeys = new Set<string>();
    for (const field of seedConfig.fields) {
      if (field.kind !== 'output' || field.formula === null) continue;
      for (const match of field.formula.matchAll(/\{\{mat:([^}]+)\}\}/g)) materialKeys.add(defined(match[1]));
    }
    expect([...materialKeys].sort()).toEqual(['scrapRate', 'specificGravity']);
  });

  it('[AQP-97 AC-5] no seed formula uses the Plating rate (D-40); each of the other 14 seed rates is used by at least one', () => {
    const formulas = seedConfig.fields.flatMap((field) => (field.kind === 'output' && field.formula !== null ? [field.formula] : []));
    const plating = defined(SEED_PROCESS_ITEMS.find((item) => item.name === 'Plating-rate-per-sqin'));
    expect(formulas.some((formula) => formula.includes(`{{rate:${plating.id}}}`))).toBe(false);
    for (const item of SEED_PROCESS_ITEMS.filter((candidate) => candidate !== plating)) {
      expect(formulas.some((formula) => formula.includes(`{{rate:${item.id}}}`)), item.name).toBe(true);
    }
  });

  it('[AQP-97 AC-5] every {{f:..}} reference names a field of the registry; a reference to a missing field, a bad rate, material or currency is refused', () => {
    const ids = new Set(seedConfig.fields.map((field) => field.id));
    for (const field of seedConfig.fields) {
      if (field.kind !== 'output' || field.formula === null) continue;
      for (const match of field.formula.matchAll(/\{\{f:([^}]+)\}\}/g)) expect(ids.has(defined(match[1]))).toBe(true);
    }
    const planted: ReadonlyArray<readonly [string, string]> = [
      ['a missing field', '{{f:00000000-0000-4000-8000-00ff00000001}} + 1'],
      ['a rate that is not an ID', '{{rate:Cutting-Rate-per-Sec}}'],
      ['a material value that does not exist', '{{mat:bogus}}'],
      ['a currency that does not exist', '{{fx:GBP}}'],
      ['an unknown prefix', '{{zz:1}}'],
      ['an unclosed reference', '{{f:00000000-0000-4000-8000-000100000001'],
    ];
    for (const [name, formula] of planted) {
      const document = cloneSeedConfig();
      Object.assign(defined(document.fields[positionOf('AL') - 1]), { formula });
      expect(() => parseConfigDocument(document), name).toThrow(ConfigDocumentError);
    }
  });
});

describe('[AQP-97 AC-5] the 15 Process Master seed IDs (D-38)', () => {
  it('[AQP-97 AC-5] seed-ids lists the 15 names and units of SPEC 4.1, in the SPEC order', () => {
    const rates = specRates();
    expect(rates).toHaveLength(15);
    expect(SEED_PROCESS_ITEMS.map(({ name, unit }) => ({ name, unit }))).toEqual(rates);
  });

  it('[AQP-97 AC-5] Plating-rate-per-sqin is the ninth, per sq in; Soft-Anodize-rate-per-sqin is per sq in', () => {
    expect(defined(SEED_PROCESS_ITEMS[8])).toMatchObject({ name: 'Plating-rate-per-sqin', unit: 'per sq in' });
    expect(SEED_PROCESS_ITEMS.find((item) => item.name === 'Soft-Anodize-rate-per-sqin')?.unit).toBe('per sq in');
  });

  it('[AQP-97 AC-5] the IDs are fixed, distinct, valid UUIDs, and pinned so a change is noticed by 02.01\'s comparison (frozen values)', () => {
    const ids = SEED_PROCESS_ITEMS.map((item) => item.id);
    expect(new Set(ids).size).toBe(15);
    expect(ids).toEqual(Array.from({ length: 15 }, (_unused, index) => `00000000-0000-4000-8000-0004${String(index + 1).padStart(8, '0')}`));
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('[AQP-97 AC-5] no rate ID collides with a field, section or stage ID of the seed', () => {
    const others = new Set([...seedConfig.fields.map((field) => field.id), ...seedConfig.sections.map((entry) => entry.id), ...seedConfig.stages.map((stage) => stage.id)]);
    for (const item of SEED_PROCESS_ITEMS) expect(others.has(item.id)).toBe(false);
    expect(others.size).toBe(67 + 8 + 6);
  });

  it('[AQP-97 AC-5] every {{rate:..}} in the seed is one of the 15 fixed IDs', () => {
    const known = new Set(SEED_PROCESS_ITEMS.map((item) => item.id));
    for (const field of seedConfig.fields) {
      if (field.kind !== 'output' || field.formula === null) continue;
      for (const match of field.formula.matchAll(/\{\{rate:([^}]+)\}\}/g)) expect(known.has(defined(match[1]))).toBe(true);
    }
  });
});

// ---- AC-7 ---------------------------------------------------------------------------------------------------------

describe('[AQP-97 AC-7] the seed holds structure only', () => {
  it('[AQP-97 AC-7] the only numbers in the stored document are positions, form orders, numbers and widths; formula constants are those the SPEC prints', () => {
    const numberKeys = new Set<string>();
    const walk = (value: unknown, key: string): void => {
      if (Array.isArray(value)) value.forEach((child) => walk(child, key));
      else if (typeof value === 'object' && value !== null) Object.entries(value).forEach(([childKey, child]) => walk(child, childKey));
      else if (typeof value === 'number') numberKeys.add(key);
    };
    walk(JSON.parse(JSON.stringify(seedConfig)), 'document');
    expect([...numberKeys].sort()).toEqual(['formOrder', 'number', 'position', 'width']);
  });

  it('[AQP-97 AC-7] the only default values are "None" (Fasteners) and "0" (the eight flags); no field has options (no master list is seeded)', () => {
    const defaults = seedConfig.fields.flatMap((field) => (field.kind === 'input' && field.defaultValue !== null ? [[letterOf(field.position), field.defaultValue]] : []));
    expect(defaults).toEqual([['S', 'None'], ...['Z', 'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG'].map((letter) => [letter, '0'])]);
    expect(seedConfig.fields.filter((field) => field.kind === 'input' && field.options !== null)).toHaveLength(0);
  });

  it('[AQP-97 AC-7] the numeric literals inside formulas are exactly those of SPEC 7.4: 0, 2, 144, 645, 1000000', () => {
    const literals = new Set<string>();
    for (const field of seedConfig.fields) {
      if (field.kind !== 'output' || field.formula === null) continue;
      for (const match of field.formula.replace(/\{\{[^}]+\}\}/g, '').matchAll(/\d+(?:\.\d+)?/g)) literals.add(match[0]);
    }
    expect([...literals].sort((a, b) => Number(a) - Number(b))).toEqual(['0', '2', '144', '645', '1000000']);
  });

  it('[AQP-97 AC-7] the seed document is deep-frozen: nothing can be written into what every caller shares', () => {
    const frozen: string[] = [];
    const walk = (value: unknown, path: string): void => {
      if (typeof value !== 'object' || value === null) return;
      if (!Object.isFrozen(value)) frozen.push(path);
      for (const [key, child] of Object.entries(value)) walk(child, `${path}.${key}`);
    };
    walk(seedConfig, 'seed');
    expect(frozen).toEqual([]);
    const first = defined(seedConfig.fields[0]);
    expect(() => {
      first.label = 'changed';
    }).toThrow(TypeError);
    expect(() => {
      seedConfig.fields.push(first);
    }).toThrow(TypeError);
    expect(first.label).toBe('Sl. No');
  });
});

// ---- AC-6, document half: a failing document is rejected, and the message keeps values out ------------------

describe('[AQP-97 AC-6] a document that fails the schema is rejected', () => {
  const SENTINEL = 'zz-secret-sentinel-7c1d';

  const mutations: ReadonlyArray<readonly [string, (document: ConfigDocument) => void]> = [
    ['an unknown kind', (document) => void Object.assign(defined(document.fields[1]), { kind: 'formula' })],
    ['a missing kind', (document) => void Reflect.deleteProperty(defined(document.fields[1]), 'kind')],
    ['a duplicate key', (document) => void (defined(document.fields[2]).key = defined(document.fields[1]).key)],
    ['a duplicate id', (document) => void (defined(document.fields[2]).id = defined(document.fields[1]).id)],
    ['a duplicate form order', (document) => void Object.assign(defined(document.fields[positionOf('K') - 1]), { formOrder: defined(document.fields[positionOf('J') - 1]).formOrder })],
    ['engineerVisible on an output', (document) => void (defined(document.fields[positionOf('M') - 1]).engineerVisible = true)],
    ['a position gap', (document) => void (defined(document.fields[5]).position = 99)],
    ['position as text', (document) => void Object.assign(defined(document.fields[5]), { position: '6' })],
    ['a position of zero', (document) => void (defined(document.fields[0]).position = 0)],
    ['an id that is not a UUID', (document) => void (defined(document.fields[3]).id = 'not-a-uuid')],
    ['a key in capitals', (document) => void (defined(document.fields[3]).key = 'Part-No')],
    ['a key with a space', (document) => void (defined(document.fields[3]).key = 'part no')],
    ['a key that ends in a hyphen', (document) => void (defined(document.fields[3]).key = 'part-')],
    ['a key of 61 characters', (document) => void (defined(document.fields[3]).key = 'a'.repeat(61))],
    ['an empty label', (document) => void (defined(document.fields[3]).label = '')],
    ['a label of 201 characters', (document) => void (defined(document.fields[3]).label = 'x'.repeat(201))],
    ['a width of zero', (document) => void (defined(document.fields[3]).width = 0)],
    ['a negative width', (document) => void (defined(document.fields[3]).width = -5)],
    ['a width over 255', (document) => void (defined(document.fields[3]).width = 256)],
    ['a width of NaN', (document) => void (defined(document.fields[3]).width = Number.NaN)],
    ['a data type that does not exist', (document) => void Object.assign(defined(document.fields[3]), { dataType: 'money' })],
    ['an output with a text data type', (document) => void Object.assign(defined(document.fields[positionOf('M') - 1]), { dataType: 'text' })],
    ['an auto field with a number data type', (document) => void Object.assign(defined(document.fields[0]), { dataType: 'number' })],
    ['a formula on an input', (document) => void Object.assign(defined(document.fields[3]), { formula: '1' })],
    ['a default on an output', (document) => void Object.assign(defined(document.fields[positionOf('M') - 1]), { defaultValue: '1' })],
    ['an empty formula', (document) => void Object.assign(defined(document.fields[positionOf('M') - 1]), { formula: '' })],
    ['a formula of 2001 characters', (document) => void Object.assign(defined(document.fields[positionOf('M') - 1]), { formula: '1'.repeat(2_001) })],
    ['hideWhenZero naming no field', (document) => void Object.assign(defined(document.fields[positionOf('AQ') - 1]), { hideWhenZero: '00000000-0000-4000-8000-00ff00000001' })],
    ['hideWhenZero naming itself', (document) => void Object.assign(defined(document.fields[positionOf('AQ') - 1]), { hideWhenZero: defined(document.fields[positionOf('AQ') - 1]).id })],
    ['visibleWhen naming no field', (document) => void Object.assign(defined(document.fields[positionOf('T') - 1]), { visibleWhen: { fieldId: '00000000-0000-4000-8000-00ff00000001', operator: 'not-in', values: ['None'] } })],
    ['visibleWhen with an unknown operator', (document) => void Object.assign(defined(document.fields[positionOf('T') - 1]), { visibleWhen: { fieldId: defined(document.fields[positionOf('S') - 1]).id, operator: 'in', values: ['None'] } })],
    ['visibleWhen with no values', (document) => void Object.assign(defined(document.fields[positionOf('T') - 1]), { visibleWhen: { fieldId: defined(document.fields[positionOf('S') - 1]).id, operator: 'not-in', values: [] } })],
    ['a section that does not exist', (document) => void (defined(document.fields[3]).sectionId = '00000000-0000-4000-8000-00ff00000001')],
    ['a stage that does not exist', (document) => void (defined(document.fields[positionOf('M') - 1]).stageId = '00000000-0000-4000-8000-00ff00000001')],
    ['a group that is not a sub-heading of the stage', (document) => void (defined(document.fields[positionOf('AL') - 1]).group = 'Not a heading')],
    ['product scope on an input', (document) => void (defined(document.fields[3]).rowScope = 'product')],
    ['multiline on a number input', (document) => void Object.assign(defined(document.fields[positionOf('J') - 1]), { multiline: true })],
    ['an empty options list', (document) => void Object.assign(defined(document.fields[positionOf('E') - 1]), { options: [] })],
    ['a duplicate section number', (document) => void (defined(document.sections[1]).number = 1)],
    ['a duplicate stage id', (document) => void (defined(document.stages[1]).id = defined(document.stages[0]).id)],
    ['an unknown display mode', (document) => void Object.assign(defined(document.sections[0]), { displayMode: 'grid' })],
    ['an unknown top-level property', (document) => void Object.assign(document, { extra: 1 })],
    ['no fields', (document) => void (document.fields = [])],
    ['no sections', (document) => void (document.sections = [])],
  ];

  it.each(mutations)('[AQP-97 AC-6] refuses %s', (_name, change) => {
    const document = cloneSeedConfig();
    change(document);
    expect(() => parseConfigDocument(document)).toThrow(ConfigDocumentError);
  });

  it.each([null, undefined, 'seed', 7, [], true])('[AQP-97 AC-6] refuses a document that is %j', (value) => {
    expect(() => parseConfigDocument(value)).toThrow(ConfigDocumentError);
  });

  it('[AQP-97 AC-6] a __proto__ key in the JSON is refused as an unknown property and does not pollute Object', () => {
    const text = JSON.stringify(seedConfig).replace(/^\{/, '{"__proto__":{"polluted":true},');
    expect(() => parseConfigDocument(JSON.parse(text))).toThrow(ConfigDocumentError);
    expect(Reflect.get({}, 'polluted')).toBeUndefined();
  });

  it('[AQP-97 AC-6] the error names paths and rules and never a value from the document', () => {
    const document = cloneSeedConfig();
    Object.assign(defined(document.fields[3]), { kind: SENTINEL, label: SENTINEL, hint: SENTINEL });
    Object.assign(defined(document.fields[4]), { dataType: SENTINEL, key: SENTINEL, formula: SENTINEL });
    Object.assign(defined(document.fields[positionOf('M') - 1]), { formula: `${SENTINEL} + {{f:${SENTINEL}}}`, engineerVisible: true });
    Object.assign(defined(document.sections[0]), { name: 5, displayMode: SENTINEL });
    let message = '';
    try {
      parseConfigDocument(document);
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigDocumentError);
      message = error instanceof Error ? error.message : '';
    }
    expect(message.length).toBeGreaterThan(0);
    expect(message).not.toContain(SENTINEL);
  });
});
