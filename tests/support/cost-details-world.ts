import { findFieldByKey } from '../../src/lib/fields/registry';
import type { CalculationRepository, FigureBasis, RowWorkingRecord } from '../../src/server/repositories/calculation-repository';
import type { NodeRecord } from '../../src/server/repositories/estimate-node-repository';
import { createCostDetailsService, type CostDetailsDependencies, type CostDetailsService } from '../../src/server/services/cost-details-service';
import type { ConfigVersion } from '../../src/server/services/config-service';

import { defined } from './defined';
import { seedConfig, seedFieldAt } from './seed-config';
import { storedRowOf, type StoredRowOptions } from './stored-row';

/**
 * An in-memory world for the cost details of one row (STORY-06.03): an estimate with two parts (1 Bracket, 2 Cover), the calculation record as Calculate stored it (the invented row of `row-oracle.ts`
 * for each part, made by the real row calculator), and the cost details service over them, with every read counted so a test can say what was **not** read. Every ID, name and number is invented.
 */

export const COST_ESTIMATE_ID = '00000000-0000-4000-8000-0000000e5718';
export const COST_FIRST_NODE_ID = '00000000-0000-4000-8000-000000000001';
export const COST_SECOND_NODE_ID = '00000000-0000-4000-8000-000000000002';
export const COST_CALCULATED_AT = new Date('2026-11-05T05:12:00.000Z');
export const COST_CONFIGURATION_NUMBER = 9;
export const COST_CALCULATION_REVISION = 3;

const CALCULATION_ID = '00000000-0000-4000-8000-0000000ca1c1';
const VERSION_ID = '00000000-0000-4000-8000-0000000c0f21';
const CURRENT_VERSION_ID = '00000000-0000-4000-8000-0000000c0f22';

export interface CostWorldOptions {
  /** `false`: no calculation is linked. */
  readonly calculated?: boolean;
  /** The estimate's input changes so far; the calculation was made at 3. */
  readonly inputsRevision?: number;
  /** How the first part's row was stored (its material, its row, its exchange rates). */
  readonly first?: StoredRowOptions;
  /** How the second part's row was stored. */
  readonly second?: StoredRowOptions;
}

export interface ReadLog {
  readonly calls: unknown[][];
  readonly record: (...args: unknown[]) => void;
}

function readLog(): ReadLog {
  const calls: unknown[][] = [];
  return { calls, record: (...args) => void calls.push(args) };
}

export interface CostWorld {
  readonly service: CostDetailsService;
  readonly dependencies: CostDetailsDependencies;
  readonly nodes: NodeRecord[];
  readonly reads: { readonly basis: ReadLog; readonly working: ReadLog; readonly nodes: ReadLog; readonly currentVersion: ReadLog; readonly versionById: ReadLog };
  /** The stored rows by node ID, which a test may change before it asks. */
  readonly rows: Map<string, RowWorkingRecord>;
}

export function createCostWorld(options: CostWorldOptions = {}): CostWorld {
  const calculated = options.calculated ?? true;
  const nodes: NodeRecord[] = [
    { id: COST_FIRST_NODE_ID, parentId: null, sortIndex: 0, nodeKind: 'MAIN_ASSEMBLY', revision: 1, imageId: null, inputs: { [defined(findFieldByKey(seedConfig, 'description')).id]: 'Invented Bracket', [seedFieldAt('H').id]: '3' } },
    { id: COST_SECOND_NODE_ID, parentId: null, sortIndex: 1, nodeKind: 'MAIN_ASSEMBLY', revision: 1, imageId: null, inputs: { [defined(findFieldByKey(seedConfig, 'part-no')).id]: 'INV-0002' } },
  ];
  const rows = new Map<string, RowWorkingRecord>();
  for (const [nodeId, stored] of [
    [COST_FIRST_NODE_ID, storedRowOf(options.first)],
    [COST_SECOND_NODE_ID, storedRowOf(options.second)],
  ] as const) {
    rows.set(nodeId, { masterSnapshot: stored.snapshot, inputs: stored.inputs, outputs: stored.outputs });
  }
  const version: ConfigVersion = { id: VERSION_ID, number: COST_CONFIGURATION_NUMBER, document: seedConfig, reason: 'Invented', createdBy: null, createdAt: COST_CALCULATED_AT.toISOString() };
  const current: ConfigVersion = { ...version, id: CURRENT_VERSION_ID, number: COST_CONFIGURATION_NUMBER + 1 };
  const basis: FigureBasis = {
    inputsRevision: options.inputsRevision ?? COST_CALCULATION_REVISION,
    calculation: calculated ? { id: CALCULATION_ID, inputsRevision: COST_CALCULATION_REVISION, configVersionId: VERSION_ID, createdAt: COST_CALCULATED_AT } : null,
  };
  const reads = { basis: readLog(), working: readLog(), nodes: readLog(), currentVersion: readLog(), versionById: readLog() };
  const calculations: Pick<CalculationRepository, 'findFigureBasis' | 'findRowWorking'> = {
    findFigureBasis: (id) => {
      reads.basis.record(id);
      return Promise.resolve(id === COST_ESTIMATE_ID ? basis : null);
    },
    findRowWorking: (calculationId, nodeId) => {
      reads.working.record(calculationId, nodeId);
      return Promise.resolve(calculationId === CALCULATION_ID ? (rows.get(nodeId) ?? null) : null);
    },
  };
  const dependencies: CostDetailsDependencies = {
    calculations,
    nodes: {
      listNodes: (id) => {
        reads.nodes.record(id);
        return Promise.resolve(id === COST_ESTIMATE_ID ? nodes : []);
      },
    },
    configuration: {
      current: () => {
        reads.currentVersion.record();
        return Promise.resolve(current);
      },
      byId: (id) => {
        reads.versionById.record(id);
        return id === VERSION_ID ? Promise.resolve(version) : Promise.reject(new Error('Invented: no such version.'));
      },
    },
  };
  return { service: createCostDetailsService(dependencies), dependencies, nodes, reads, rows };
}
