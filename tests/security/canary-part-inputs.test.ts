import { describe, expect, it } from 'vitest';

import { buildFormSections } from '@/lib/estimate/form-fields';

import { forbiddenStrings } from '../support/canary-masters';
import { canaryPartInputs, canaryRateFieldId, canaryTypedValues, CANARY_PLANTED_RATE, CANARY_UNKNOWN_KEY } from '../support/canary-part-inputs';
import { defined } from '../support/defined';
import { inputsDependencies } from '../support/estimate-inputs-deps';
import { createFakeEstimateWorld } from '../support/fake-estimates';
import { seedConfig } from '../support/seed-config';

import { createEstimateService, type EstimateViewer } from '@/server/services/estimate-service';

/**
 * STORY-05.04 AC-7 (NFR-002; STORY-01.03 AC-6; review SQR-05 of STORY-05.03): the canary part of the scan holds what an Engineer types in every section of the form, and two things that no
 * answer may carry (a canary price under Material Rate / Kg, and a key that is no field). Shown here, without a browser: the typed values are values the form accepts, every typed field of
 * the form has one (so a field a story adds is scanned with no edit), the planted price is one the scan forbids, and the part read back through the real service holds the typed values
 * and nothing else, for every role. Every value is invented.
 */

const RATE_FIELD_ID = canaryRateFieldId(seedConfig);
const OWNER = '00000000-0000-4000-8000-0000000000a1';
const ESTIMATE = '00000000-0000-4000-8000-0000000000e1';
const viewers: ReadonlyArray<EstimateViewer> = [
  { id: OWNER, role: 'ENGINEER' },
  { id: '00000000-0000-4000-8000-0000000000b1', role: 'LEAD' },
  { id: '00000000-0000-4000-8000-0000000000c1', role: 'ADMIN' },
];

describe('the typed values of the canary part', () => {
  it('are values the part form accepts: each is read by its own field\'s rule (a number of two decimals, a text within its length)', () => {
    expect(canaryTypedValues(seedConfig).refused).toEqual([]);
  });

  it('cover every field a person types into on the form, so a field of a new section is scanned with a value of its own', () => {
    const typedFields = buildFormSections(seedConfig)
      .flatMap((section) => section.fields)
      .filter((field) => field.editable && field.rule.type !== 'select')
      .map((field) => field.id)
      .sort();
    expect(canaryTypedValues(seedConfig).values.map((value) => value.fieldId).sort()).toEqual(typedFields);
  });

  it('include the four cost-typed inputs, which an Engineer rightly sees as they typed them (FR-008)', () => {
    const keys = canaryTypedValues(seedConfig).values.map((value) => value.key);
    for (const key of ['machining-cost', 'plating-cost', 'tool-cost', 'fasteners-cost']) expect(keys).toContain(key);
  });

  it('are stored as the form stores them: two decimals for a number, a trimmed text', () => {
    const stored = Object.fromEntries(canaryTypedValues(seedConfig).values.map((value) => [value.key, value.stored]));
    expect(stored['tool-cost']).toBe('45678.75');
    expect(stored['qty-per-assy']).toBe('7.00');
    expect(stored['remarks']).toBe('Invented remark for the canary estimate');
  });

  it('are none of them a string the scan forbids: what an Engineer types is no leak', () => {
    const forbidden = forbiddenStrings().map((entry) => entry.text);
    for (const value of canaryTypedValues(seedConfig).values) expect(forbidden, value.key).not.toContain(value.stored);
  });
});

describe('what the canary part must never send', () => {
  it('is a canary price the scan forbids, under the field that carries the material rate, and a key that is not a field', () => {
    expect(forbiddenStrings().map((entry) => entry.text)).toContain(CANARY_PLANTED_RATE);
    expect(seedConfig.fields.find((field) => field.id === RATE_FIELD_ID)?.key).toBe('material-rate-per-kg');
    expect(seedConfig.fields.some((field) => field.id === CANARY_UNKNOWN_KEY)).toBe(false);
    const inputs = canaryPartInputs(seedConfig);
    expect(inputs[RATE_FIELD_ID]).toBe(CANARY_PLANTED_RATE);
    expect(inputs[CANARY_UNKNOWN_KEY]).toBeDefined();
  });

  it('is dropped by the real service for every role: the part is read back with the typed values only, and the planted price is in no answer', async () => {
    const world = createFakeEstimateWorld(() => [], [
      { id: ESTIMATE, code: 'Q-9999-0001', engineerId: OWNER, assignedByName: 'Invented Lead', folderPath: '\\\\invented\\share', deadlineAt: new Date('2099-01-01T00:00:00.000Z'), title: null, notes: null, status: 'DRAFT', customerId: null, inputsRevision: 0 },
    ], [{ id: ESTIMATE, estimateId: ESTIMATE, parentId: null, sortIndex: 0, revision: 1, inputs: canaryPartInputs(seedConfig) }]);
    const service = createEstimateService({ estimates: world.repository, nodes: world.nodeRepository, transactions: world.transactions, ...inputsDependencies() });
    const typed = Object.fromEntries(canaryTypedValues(seedConfig).values.map((value) => [value.fieldId, value.stored]));
    for (const viewer of viewers) {
      const part = await service.getNode(viewer, ESTIMATE, ESTIMATE);
      expect(part.inputs, viewer.role).toEqual(typed);
      expect(JSON.stringify(part), viewer.role).not.toContain(CANARY_PLANTED_RATE);
      expect(JSON.stringify(part), viewer.role).not.toContain(CANARY_UNKNOWN_KEY);
    }
    // A save of one more value answers with the projection too, and keeps the planted keys where they were stored.
    const saved = await service.saveInputs(defined(viewers[0]), ESTIMATE, { nodeId: ESTIMATE, revision: 1, values: { [defined(canaryTypedValues(seedConfig).values[0]).fieldId]: '1' } });
    expect(JSON.stringify(saved)).not.toContain(CANARY_PLANTED_RATE);
    expect(world.nodes[0]?.inputs[RATE_FIELD_ID]).toBe(CANARY_PLANTED_RATE);
  });
});
