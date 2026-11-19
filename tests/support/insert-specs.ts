import type { InsertSpec, NewInput, NewOutput, NewSingleOutput } from '../../src/lib/config/field-insert';

import { defined } from './defined';
import { seedConfig, seedFieldAt } from './seed-config';

/**
 * Invented inserts of STORY-08.03 over the real seed registry, written once for every test that needs a valid call (the role matrix, the routes, the service, PostgreSQL). The names are invented; the sections, the
 * stage, the sub-heading and the number formats are the seed's, because the check reads them from the registry.
 */

export const SECTION_TWO_ID = defined(seedConfig.sections[1]).id;
export const STAGE_PROCESS = defined(seedConfig.stages[2]);
/** A sub-heading of `STAGE_PROCESS`, so a new output's `group` passes the registry's own rule. */
export const PROCESS_GROUP = defined(STAGE_PROCESS.subHeadings[0]);

/** The ID of the seed field at a SPEC letter (tests may write letters; production code derives them). */
export const fieldIdAt = (letter: string): string => seedFieldAt(letter).id;

export const newInput = (overrides: Partial<NewInput> = {}): NewInput => ({
  label: 'Invented Notch Count',
  dataType: 'number',
  defaultValue: '',
  sectionId: SECTION_TWO_ID,
  unit: '',
  hint: '',
  width: 12,
  numFmt: '0.00',
  watchFieldId: null,
  ...overrides,
});

/** The details every output has, a single one and the pair's cost column alike. */
export const outputDetails = (overrides: Partial<NewOutput> = {}): NewOutput => ({
  label: 'Invented Notch Cost',
  formula: '1',
  stageId: STAGE_PROCESS.id,
  group: PROCESS_GROUP,
  width: 14,
  numFmt: '#,##0.00',
  ...overrides,
});

export const newOutput = (overrides: Partial<NewSingleOutput> = {}): NewSingleOutput => ({ ...outputDetails(), hideWhenZeroFieldId: null, ...overrides });

/** An input after AX: the example of SPEC section 14 item 6 (the new field is AY). */
export const inputAfterAx = (overrides: Partial<NewInput> = {}): InsertSpec => ({ kind: 'input', afterFieldId: fieldIdAt('AX'), input: newInput(overrides) });

/** An output after AX with a formula that reads nothing, so it is valid in any document. */
export const outputAfterAx = (overrides: Partial<NewSingleOutput> = {}): InsertSpec => ({ kind: 'output', afterFieldId: fieldIdAt('AX'), output: newOutput(overrides) });

/** An input and its cost column after AX; the cost formula is typed in the letters after the insert, so it names the new input AY (decision D-1). */
export const pairAfterAx = (inputOverrides: Partial<NewInput> = {}): InsertSpec => ({
  kind: 'pair',
  afterFieldId: fieldIdAt('AX'),
  input: newInput(inputOverrides),
  cost: { ...outputDetails({ formula: 'AY * 2' }), afterFieldId: null, hideWhenInputIsZero: true },
});
