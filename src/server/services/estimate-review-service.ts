import { assertNever } from '../../lib/assert-never';
import { ForbiddenError, NotFoundError } from '../../lib/errors';
import { partNameOf, typedText } from '../../lib/estimate/part-name';
import { figureState, readFiguresWhenCurrent } from '../../lib/estimate/figure-state';
import { buildTree } from '../../lib/estimate/tree';
import { fieldLetter, findFieldByKey, findSystemField } from '../../lib/fields/registry';
import type { FieldDefinition } from '../../lib/fields/field-schema';
import type { ConfigDocument } from '../../lib/fields/schema';
import { PRICE_PER_TOOL_COST_KEY, UNIT_PRICE_EUR_KEY, UNIT_PRICE_USD_KEY } from '../../lib/fields/types';
import type { CalculationRepository, ReviewFigures, StoredValues } from '../repositories/calculation-repository';
import type { EstimateNodeRepository, NodeRecord } from '../repositories/estimate-node-repository';
import { costsSchema, type CostNode, type CostsView } from '../views/schemas/costs';

import type { ConfigVersion } from './config-service';
import type { EstimateViewer } from './estimate-service';

/**
 * The read side of the estimate review (STORY-06.02; FR-024, FR-025, FR-029, FR-030; architecture sections 4.3, 4.8 and 6 "Cost"): the figures of SCR-06, for the Lead and the Admin.
 *
 * **Restricted** (ADR-008, NFR-002): it reads the calculation record, so it is classed as blocked for every Engineer view (`tests/security/engineer-import-rule.test.ts`), and `server-only`
 * code only reaches it through the composition. Who may call is decided before it is reached (the manifest row, `withRoute`, `authorizePage`), and it refuses an Engineer **again before it
 * reads anything**, so a caller that skipped those steps still learns nothing and causes no lookup.
 *
 * **Every read of a figure goes through `lib/estimate/figure-state.ts`** (AC-7): the state is worked out from two counts, and the figures are read only while it is `current`
 * (`readFiguresWhenCurrent`). In `none` and `out-of-date` no calculated value is read, so none can be in the answer. The part's count (H) and name are inputs, read from the parts as they are now.
 *
 * **No rolled-up figure** (architecture section 4.3): a part carries its own row's BG, BJ and BK, and the answer holds no sum except BL, BN and the total Tool Cost, which the calculation stored.
 * The answer is parsed with its strict schema before it leaves.
 */

export interface EstimateReviewService {
  /**
   * `GET /api/v1/estimates/{id}/costs`. 403 for an Engineer, before anything is read; 404 for an estimate that does not exist (or an ID that is not one). The parts and their counts are
   * always there; the figures only while the state is `current`.
   */
  getCosts(viewer: EstimateViewer, estimateId: string): Promise<CostsView>;
}

export interface EstimateReviewDependencies {
  readonly calculations: Pick<CalculationRepository, 'findFigureBasis' | 'findReviewFigures'>;
  readonly nodes: Pick<EstimateNodeRepository, 'listNodes'>;
  readonly configuration: {
    /** The version in force now, used while no calculation exists (the letters and the count's field). */
    readonly current: () => Promise<ConfigVersion>;
    /** The version a calculation was made with, by its ID. */
    readonly byId: (id: string) => Promise<ConfigVersion>;
  };
}

/** What the plain Excel letters of the review are read from: the registry version the figures belong to. */
interface Columns {
  readonly count: FieldDefinition;
  readonly unitPrice: FieldDefinition;
  readonly unitPriceUsd: FieldDefinition;
  readonly unitPriceEur: FieldDefinition;
  readonly totalPrice: FieldDefinition;
  readonly pricePerToolCost: FieldDefinition;
  readonly approvedPrice: FieldDefinition;
}

const DECIMAL_TEXT = /^-?\d+(\.\d+)?$/;

/** A field the registry must hold for the review to be drawn: a version without it is a fault in the data (a plain `Error`, a 500 with fixed words), never a half-drawn screen. */
function required(field: FieldDefinition | undefined, what: string): FieldDefinition {
  if (field === undefined) throw new Error(`The configuration version has no field for ${what}.`);
  return field;
}

function columnsOf(document: ConfigDocument): Columns {
  return {
    count: required(findSystemField(document, 'quantity'), 'the count of a part'),
    unitPrice: required(findSystemField(document, 'unit-price'), "a row's own price"),
    unitPriceUsd: required(findFieldByKey(document, UNIT_PRICE_USD_KEY), "a row's price in US dollars"),
    unitPriceEur: required(findFieldByKey(document, UNIT_PRICE_EUR_KEY), "a row's price in euros"),
    totalPrice: required(findSystemField(document, 'total'), 'the total price'),
    pricePerToolCost: required(findFieldByKey(document, PRICE_PER_TOOL_COST_KEY), 'the price per Tool Cost'),
    approvedPrice: required(findSystemField(document, 'approved-price'), 'the approved price'),
  };
}

const lettersOf = (columns: Columns): CostsView['letters'] => ({
  count: fieldLetter(columns.count),
  unitPrice: fieldLetter(columns.unitPrice),
  unitPriceUsd: fieldLetter(columns.unitPriceUsd),
  unitPriceEur: fieldLetter(columns.unitPriceEur),
  totalPrice: fieldLetter(columns.totalPrice),
  pricePerToolCost: fieldLetter(columns.pricePerToolCost),
  approvedPrice: fieldLetter(columns.approvedPrice),
});

/** A stored figure as decimal text, or `null` when the row has none (a field with no figure, or a value that is no decimal). */
const figureOf = (stored: StoredValues | undefined, field: FieldDefinition): string | null => {
  const value = stored?.[field.id];
  return typeof value === 'string' && DECIMAL_TEXT.test(value) ? value : null;
};

function nodesOf(records: ReadonlyArray<NodeRecord>, document: ConfigDocument, columns: Columns, figures: ReviewFigures | null): CostNode[] {
  const outputsByNode = new Map(figures?.rows.map((row) => [row.nodeId, row.outputs]));
  return buildTree(records).map(({ node, slNo }) => {
    const count = typedText(node.inputs, columns.count);
    const outputs = outputsByNode.get(node.id);
    return {
      id: node.id,
      parentId: node.parentId,
      slNo,
      name: partNameOf(document, node.inputs),
      count: count !== null && DECIMAL_TEXT.test(count) ? count : null,
      // A row's own figures and nothing summed over the rows below it (architecture section 4.3).
      figures:
        figures === null || outputs === undefined
          ? null
          : { unitPrice: figureOf(outputs, columns.unitPrice), unitPriceUsd: figureOf(outputs, columns.unitPriceUsd), unitPriceEur: figureOf(outputs, columns.unitPriceEur) },
    };
  });
}

export function createEstimateReviewService({ calculations, nodes, configuration }: EstimateReviewDependencies): EstimateReviewService {
  return {
    async getCosts(viewer, estimateId) {
      // Before any read, and by name: only the Lead and the Admin are let through, an Engineer is refused whatever the ID is (CR-33, NFR-002), and a role added one day fails to compile here
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

      const { calculation } = basis;
      const state = figureState({ inputsRevision: basis.inputsRevision, calculationInputsRevision: calculation?.inputsRevision ?? null });
      const [version, records, figures] = await Promise.all([
        calculation === null ? configuration.current() : configuration.byId(calculation.configVersionId),
        nodes.listNodes(estimateId),
        calculation === null ? Promise.resolve(null) : readFiguresWhenCurrent(state, () => calculations.findReviewFigures(calculation.id)),
      ]);
      // A calculation that is current but cannot be read is a fault in the data: say nothing about the figures rather than show dashes as if they were the answer.
      if (state === 'current' && figures === null) throw new Error('The calculation linked to the estimate could not be read.');

      const columns = columnsOf(version.document);
      return costsSchema.parse({
        state,
        calculatedAt: calculation === null ? null : calculation.createdAt.toISOString(),
        configurationNumber: calculation === null ? null : version.number,
        letters: lettersOf(columns),
        nodes: nodesOf(records, version.document, columns, figures),
        totals: figures === null ? null : figures.productValues,
      });
    },
  };
}
