import { defined } from './defined';
import { harness } from './session-harness';
import { storedRowOf } from './stored-row';

/**
 * A calculation planted in the in-memory world of the session harness, for the tests of the export route and page (STORY-07.02 to 07.04): one calculation of the harness estimate's one part, linked to it and
 * made at the estimate's input revision of the moment, holding the stored row of the invented oracle row, so the estimate's figures are `current`. Raising `inputsRevision` afterwards makes them out of date;
 * `clearPlantedCalculation` puts the world back as the harness made it. Every ID and number is invented.
 */

const CALCULATION_ID = '00000000-0000-4000-8000-0000000ca1ca';

const estimate = () => defined(harness.estimateWorld.estimates[0]);
const part = () => defined(harness.estimateWorld.nodes[0]);

export function plantCalculation(): ReturnType<typeof storedRowOf> {
  const stored = storedRowOf();
  harness.calculationWorld.calculations.push({
    id: CALCULATION_ID,
    estimateId: estimate().id,
    configVersionId: '00000000-0000-4000-8000-0aaa00000001',
    inputsRevision: estimate().inputsRevision,
    masterSnapshot: stored.snapshot,
    productValues: { totalPrice: '451.398096', pricePerToolCost: null, toolCostTotal: '0' },
    createdById: harness.idOf.ENGINEER,
    warnings: [],
    createdAt: new Date('2026-11-05T05:12:00.000Z'),
    rows: [{ id: '00000000-0000-4000-8000-0000000ca1d1', nodeId: part().id, parentId: null, sortIndex: 0, slNo: '1', inputs: stored.inputs, imageId: null, outputs: stored.outputs }],
  });
  estimate().currentCalculationId = CALCULATION_ID;
  return stored;
}

/** The harness as it was: no calculation, the estimate's revision back at 0. */
export function clearPlantedCalculation(): void {
  estimate().inputsRevision = 0;
  estimate().currentCalculationId = null;
  harness.calculationWorld.calculations.length = 0;
}
