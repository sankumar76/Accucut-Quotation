import { assertNever } from '../../lib/assert-never';
import { ForbiddenError, NotFoundError } from '../../lib/errors';
import { buildCostWorking } from '../../lib/estimate/cost-working';
import { figureState, readFiguresWhenCurrent } from '../../lib/estimate/figure-state';
import { partNameOf } from '../../lib/estimate/part-name';
import { buildTree } from '../../lib/estimate/tree';
import type { FieldDefinition } from '../../lib/fields/field-schema';
import { fieldLetter, findSystemField } from '../../lib/fields/registry';
import { createPlanCache, type PlanCache } from '../../lib/formula';
import type { CalculationRepository } from '../repositories/calculation-repository';
import type { EstimateNodeRepository, NodeRecord } from '../repositories/estimate-node-repository';
import { nodeCostsSchema, type NodeCostsView } from '../views/schemas/node-costs';

import type { ConfigVersion } from './config-service';
import type { EstimateViewer } from './estimate-service';

/**
 * The cost details of one row (STORY-06.03; FR-058 to FR-060, FR-026, FR-100; architecture sections 4.9 and 6 "Cost details"): SCR-07, the six stages of a row with each formula next to its value, for the Lead
 * and the Admin.
 *
 * **Restricted** (ADR-008, NFR-002): it reads the calculation record and answers with formulas, rate values and calculated costs, so it is classed as blocked for every Engineer view
 * (`tests/security/engineer-import-rule.test.ts`), and `server-only` code reaches it only through the composition. Who may call is decided before it is reached (the manifest row, `withRoute`,
 * `authorizePage`), and it refuses an Engineer **again before it reads anything**, by name and closed by `assertNever`: a role added one day fails to compile here and is refused at run time.
 *
 * **Every read of a figure goes through `lib/estimate/figure-state.ts`** (STORY-06.02 AC-7): the state is worked out from two counts, and the row's stored working is read only while it is `current`
 * (`readFiguresWhenCurrent`). In `none` and `out-of-date` nothing calculated is read, so none can be in the answer, which holds the row's place and name and `details: null` (FR-100). The part's
 * place and name are inputs, read from the parts as they are now. A part that is not in this estimate is a 404, the same as an estimate that does not exist (CR-33), so another estimate's part
 * is never reached through this one.
 *
 * **It never recomputes with today's masters**: the working is built from the row's stored inputs and outputs, the snapshot of the masters the calculation used and the configuration version it
 * was made with (`lib/estimate/cost-working.ts`), and each formula must reproduce its stored figure or the read fails. The answer is parsed with its strict schema before it leaves.
 */

export interface CostDetailsService {
  /**
   * `GET /api/v1/estimates/{id}/nodes/{nodeId}/costs`. 403 for an Engineer, before anything is read; 404 for an estimate that does not exist, an ID that is not one, and a part that is not in this
   * estimate. The state alone while it is `none` or `out-of-date`; the six stages of the row while `current`.
   */
  getNodeCosts(viewer: EstimateViewer, estimateId: string, nodeId: string): Promise<NodeCostsView>;
  /** The same for the part with this Sl. No (`1.2`), which is how SCR-07's address names a row. */
  getNodeCostsBySlNo(viewer: EstimateViewer, estimateId: string, slNo: string): Promise<NodeCostsView>;
}

export interface CostDetailsDependencies {
  readonly calculations: Pick<CalculationRepository, 'findFigureBasis' | 'findRowWorking'>;
  readonly nodes: Pick<EstimateNodeRepository, 'listNodes'>;
  readonly configuration: {
    /** The version in force now, used while no calculation exists (the name of a part is read through it). */
    readonly current: () => Promise<ConfigVersion>;
    /** The version a calculation was made with, by its ID. */
    readonly byId: (id: string) => Promise<ConfigVersion>;
  };
  /** Compiled plans by version. A test passes its own to count compiles; the default is one cache for the service. */
  readonly plans?: PlanCache;
}

/** Which part of the estimate is asked for: by its ID, or by its Sl. No in the tree. */
type PartAsked = { readonly by: 'id'; readonly nodeId: string } | { readonly by: 'sl-no'; readonly slNo: string };

/** A field the registry must hold for the screen to be drawn: a version without it is a fault in the data (a plain `Error`, a 500 with fixed words), never a half-drawn screen. */
function required(field: FieldDefinition | undefined, what: string): FieldDefinition {
  if (field === undefined) throw new Error(`The configuration version has no field for ${what}.`);
  return field;
}

const DECIMAL_TEXT = /^-?\d+(\.\d+)?$/;

export function createCostDetailsService({ calculations, nodes, configuration, plans = createPlanCache() }: CostDetailsDependencies): CostDetailsService {
  /** The part asked for among the estimate's own parts, with its Sl. No, or `NotFoundError`. Parts of any other estimate are not in the list, so they are never found. */
  function findPart(records: ReadonlyArray<NodeRecord>, asked: PartAsked): { readonly node: NodeRecord; readonly slNo: string } {
    const entry = buildTree(records).find((candidate) => (asked.by === 'id' ? candidate.node.id === asked.nodeId : candidate.slNo === asked.slNo));
    if (entry === undefined) throw new NotFoundError();
    return { node: entry.node, slNo: entry.slNo };
  }

  async function costsOf(viewer: EstimateViewer, estimateId: string, asked: PartAsked): Promise<NodeCostsView> {
    // Before any read, and by name: only the Lead and the Admin are let through, an Engineer is refused whatever the IDs are (CR-33, NFR-002), and a role added one day fails to compile here
    // (`assertNever`) and is refused at run time until someone decides. The route and the page refuse first; this is the second guard.
    switch (viewer.role) {
      case 'ADMIN':
      case 'LEAD':
        break;
      case 'ENGINEER':
        throw new ForbiddenError();
      default:
        return assertNever(viewer.role, 'role');
    }
    const basis = await calculations.findFigureBasis(estimateId);
    if (basis === null) throw new NotFoundError();
    const { node, slNo } = findPart(await nodes.listNodes(estimateId), asked);

    const { calculation } = basis;
    const state = figureState({ inputsRevision: basis.inputsRevision, calculationInputsRevision: calculation?.inputsRevision ?? null });
    const version = calculation === null ? await configuration.current() : await configuration.byId(calculation.configVersionId);
    const row = { nodeId: node.id, slNo, name: partNameOf(version.document, node.inputs) };
    if (calculation === null || state !== 'current') return nodeCostsSchema.parse({ state, row, details: null });

    // The one read of a calculated figure: through the figure state, and only while it is `current` (STORY-06.02 AC-7).
    const stored = await readFiguresWhenCurrent(state, () => calculations.findRowWorking(calculation.id, node.id));
    // A calculation that is current but holds no row for a part of the estimate is a fault in the data: say nothing rather than a half-true working.
    if (stored === null) throw new Error('The calculation linked to the estimate holds no row for one of its parts.');

    const { document } = version;
    const working = buildCostWorking({ document, plan: plans.get(version.id, document.fields), inputs: stored.inputs, outputs: stored.outputs, snapshot: stored.masterSnapshot });
    const count = required(findSystemField(document, 'quantity'), 'the count of a part');
    const typedCount = stored.inputs[count.id];
    return nodeCostsSchema.parse({
      state,
      row,
      details: {
        calculatedAt: calculation.createdAt.toISOString(),
        configurationNumber: version.number,
        letters: { count: fieldLetter(count), unitPrice: fieldLetter(required(findSystemField(document, 'unit-price'), "a row's own price")) },
        count: typeof typedCount === 'string' && DECIMAL_TEXT.test(typedCount) ? typedCount : null,
        notApplicable: working.notApplicable,
        hiddenLineCount: working.hiddenLineCount,
        stages: working.stages,
      },
    });
  }

  return {
    getNodeCosts: (viewer, estimateId, nodeId) => costsOf(viewer, estimateId, { by: 'id', nodeId }),
    getNodeCostsBySlNo: (viewer, estimateId, slNo) => costsOf(viewer, estimateId, { by: 'sl-no', slNo }),
  };
}
