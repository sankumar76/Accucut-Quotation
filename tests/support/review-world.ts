import type { CancelRecord, UnlockRecord } from '../../src/server/repositories/approval-repository';
import type { NodeRecord } from '../../src/server/repositories/estimate-node-repository';
import type { CalculationRepository, FigureBasis, ReviewFigures, StoredValues, StoredWarning } from '../../src/server/repositories/calculation-repository';
import type { ConfigVersion } from '../../src/server/services/config-service';
import { createEstimateReviewService, type EstimateReviewDependencies, type EstimateReviewService } from '../../src/server/services/estimate-review-service';
import { findFieldByKey } from '../../src/lib/fields/registry';
import type { EstimateStatus } from '../../src/lib/estimate/state-machine';

import { mastersNow, storedSnapshot, type FixtureMasters, type MastersNow } from './rate-change-fixture';
import { seedConfig, seedFieldAt } from './seed-config';
import type { CaseRow } from '../unit/quantity/quantity-cases';

/**
 * An in-memory world for the estimate review (STORY-06.02): the parts of one estimate as the part form stored them, the calculation record as Calculate stored it, and the estimate review
 * service over them, with every read counted so a test can say what was **not** read. The rows come from the constructed quantity cases CE-1 to CE-12 of test strategy section 5.2 (`quantity-cases.ts`),
 * whose BG and BL were worked by hand, so a screen's figure is compared with a number nobody computed here. Every ID, name and number is invented.
 */

const INVENTED_VERSION_ID = '00000000-0000-4000-8000-0000000c0f19';
/** The ID of the invented calculation a review world links. */
export const INVENTED_CALCULATION_ID = '00000000-0000-4000-8000-0000000ca1c0';
export const REVIEW_ESTIMATE_ID = '00000000-0000-4000-8000-0000000e5717';
export const REVIEW_CALCULATED_AT = new Date('2026-11-05T05:12:00.000Z');
export const REVIEW_CONFIGURATION_NUMBER = 9;
/** When the invented approval of `ReviewWorldOptions.approval` was made. */
export const REVIEW_APPROVED_AT = new Date('2026-11-05T05:50:00.000Z');
const BG = seedFieldAt('BG').id;
const BJ = seedFieldAt('BJ').id;
const BK = seedFieldAt('BK').id;
const COUNT = seedFieldAt('H').id;
const DESCRIPTION = findFieldByKey(seedConfig, 'description')?.id ?? '';
const PART_NO = findFieldByKey(seedConfig, 'part-no')?.id ?? '';

/** The ID the world gives to the node of the row with this Sl. No in a case (for a warning that names it). */
export const nodeIdOfRow = (rows: ReadonlyArray<CaseRow>, sl: string): string => nodeIdOf(rows.findIndex((row) => row.sl === sl));

export const REVIEW_FIELDS = { bg: BG, bj: BJ, bk: BK, count: COUNT, description: DESCRIPTION, partNo: PART_NO } as const;

const nodeIdOf = (index: number): string => `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;

/** The tree of a case: a row's parent is the row whose Sl. No is its own without the last number. */
export function nodesOfCase(rows: ReadonlyArray<CaseRow>, names: Readonly<Record<string, string>> = {}): NodeRecord[] {
  const idBySl = new Map(rows.map((row, index) => [row.sl, nodeIdOf(index)]));
  return rows.map((row, index) => {
    const parts = row.sl.split('.');
    const parentSl = parts.slice(0, -1).join('.');
    const name = names[row.sl];
    return {
      id: nodeIdOf(index),
      parentId: parts.length === 1 ? null : (idBySl.get(parentSl) ?? null),
      sortIndex: Number(parts[parts.length - 1]) - 1,
      revision: 1,
      imageId: null,
      inputs: { [COUNT]: row.h, ...(name === undefined ? {} : { [DESCRIPTION]: name }) },
    };
  });
}

/** A row's stored outputs: its own BG, and its BJ and BK worked from BG at invented exchange rates (80 and 90), as full-precision text. */
const outputsOf = (bg: string): StoredValues => ({ [BG]: bg, [BJ]: (Number(bg) / 80).toString(), [BK]: (Number(bg) / 90).toString() });

export interface ReviewWorldOptions {
  readonly rows: ReadonlyArray<CaseRow>;
  readonly bl: string;
  readonly names?: Readonly<Record<string, string>>;
  readonly toolCostTotal?: string | null;
  readonly pricePerToolCost?: string | null;
  /** `null`: no calculation is linked. */
  readonly calculated?: boolean;
  /** The estimate's input changes so far; the calculation was made at 3. */
  readonly inputsRevision?: number;
  /** An approval row of the estimate (STORY-06.06): the price as stored (two decimals) and who approved it. Absent: none, BO is "Not set yet". */
  readonly approval?: {
    readonly price: string;
    readonly approverName?: string;
    /** The Engineer whose task it is. Absent: Invented Priya. */
    readonly engineerName?: string;
    /** The total the price was set against, rupees and paise; absent: the price itself (an approval at the calculated total). */
    readonly calculatedTotal?: string;
    /** Absent: not an override. */
    readonly isOverride?: boolean;
    /** The reason given with an override; absent: none. */
    readonly reason?: string;
    readonly unlock?: UnlockRecord;
    /** The cancel of the approval (STORY-06.12). Absent: not cancelled. */
    readonly cancel?: CancelRecord;
  };
  /** The price of the latest approval was removed (STORY-06.13): who and when, and no price. It reads only while there is no approval standing. Absent: not removed. */
  readonly priceRemoved?: { readonly removedAt: Date; readonly byName: string };
  /** The warnings acknowledged for the calculation (STORY-06.10) and the name of the person who went ahead. Absent: none. */
  readonly warnings?: ReadonlyArray<StoredWarning>;
  readonly madeBy?: string;
  /** The estimate's status. Absent: PREPARED, the status of a calculated estimate waiting for its Lead. */
  readonly status?: EstimateStatus;
  /**
   * What changed in the masters since the calculation (STORY-06.11): the masters now, over the one fixture the unlock preview is tested with. Absent: nothing changed, so there is no notice. The calculation stored
   * `storedSnapshot()` of that fixture.
   */
  readonly mastersNow?: MastersNow;
}

export interface ReviewWorld {
  readonly service: EstimateReviewService;
  readonly dependencies: EstimateReviewDependencies;
  readonly nodes: NodeRecord[];
  readonly reads: { readonly basis: ReadLog; readonly figures: ReadLog; readonly nodes: ReadLog; readonly approvals: ReadLog; readonly removals: ReadLog; readonly access: ReadLog; readonly snapshot: ReadLog };
  /** The masters the notice reads, with how many reads of each were made (STORY-06.11 AC-7). */
  readonly masters: FixtureMasters;
}

/** The arguments of every call of one read, so a test can say what was read and what was not. */
export interface ReadLog {
  readonly calls: unknown[][];
  readonly record: (...args: unknown[]) => void;
}

function readLog(): ReadLog {
  const calls: unknown[][] = [];
  return { calls, record: (...args) => void calls.push(args) };
}

export const CALCULATION_REVISION = 3;

export function createReviewWorld(options: ReviewWorldOptions): ReviewWorld {
  const nodes = nodesOfCase(options.rows, options.names);
  const calculated = options.calculated ?? true;
  const inputsRevision = options.inputsRevision ?? CALCULATION_REVISION;
  const version: ConfigVersion = { id: INVENTED_VERSION_ID, number: REVIEW_CONFIGURATION_NUMBER, document: seedConfig, reason: 'Invented', createdBy: null, createdAt: REVIEW_CALCULATED_AT.toISOString() };
  const current: ConfigVersion = { ...version, id: '00000000-0000-4000-8000-0000000c0f20', number: REVIEW_CONFIGURATION_NUMBER + 1 };
  const figures: ReviewFigures = {
    productValues: { totalPrice: options.bl, pricePerToolCost: options.pricePerToolCost ?? null, toolCostTotal: options.toolCostTotal ?? '0' },
    rows: options.rows.map((row, index) => ({ nodeId: nodeIdOf(index), outputs: outputsOf(row.bg) })),
    warnings: options.warnings ?? [],
    madeByName: options.madeBy ?? 'Invented Calculator',
  };
  const basis: FigureBasis = {
    inputsRevision,
    calculation: calculated ? { id: INVENTED_CALCULATION_ID, inputsRevision: CALCULATION_REVISION, configVersionId: INVENTED_VERSION_ID, createdAt: REVIEW_CALCULATED_AT } : null,
  };
  const reads = { basis: readLog(), figures: readLog(), nodes: readLog(), approvals: readLog(), removals: readLog(), access: readLog(), snapshot: readLog() };
  const masters = mastersNow(options.mastersNow);
  const calculations: Pick<CalculationRepository, 'findFigureBasis' | 'findReviewFigures' | 'findMasterSnapshot'> = {
    findFigureBasis: (id) => {
      reads.basis.record(id);
      return Promise.resolve(id === REVIEW_ESTIMATE_ID ? basis : null);
    },
    findReviewFigures: (id) => {
      reads.figures.record(id);
      return Promise.resolve(id === INVENTED_CALCULATION_ID ? figures : null);
    },
    findMasterSnapshot: (id) => {
      reads.snapshot.record(id);
      return Promise.resolve(id === INVENTED_CALCULATION_ID ? { configVersionId: INVENTED_VERSION_ID, masterSnapshot: storedSnapshot() } : null);
    },
  };
  const approvals: EstimateReviewDependencies['approvals'] = {
    findLatestRemoval: (id) => {
      reads.removals.record(id);
      return Promise.resolve(options.priceRemoved === undefined || id !== REVIEW_ESTIMATE_ID ? null : options.priceRemoved);
    },
    findLatestApproval: (id) => {
      reads.approvals.record(id);
      const { approval } = options;
      return Promise.resolve(
        approval === undefined || id !== REVIEW_ESTIMATE_ID
          ? null
          : {
              id: '00000000-0000-4000-8000-0000000a9901',
              calculationId: INVENTED_CALCULATION_ID,
              approvedPrice: approval.price,
              approvedAt: REVIEW_APPROVED_AT,
              approverName: approval.approverName ?? 'Invented Approver',
              engineerName: approval.engineerName ?? 'Invented Priya',
              calculatedTotal: approval.calculatedTotal ?? approval.price,
              isOverride: approval.isOverride ?? false,
              overrideReason: approval.reason ?? null,
              unlock: approval.unlock ?? null,
              cancel: approval.cancel ?? null,
            },
      );
    },
  };
  const dependencies: EstimateReviewDependencies = {
    calculations,
    approvals,
    estimates: {
      findEstimateAccess: (id) => {
        reads.access.record(id);
        return Promise.resolve(id === REVIEW_ESTIMATE_ID ? { id, engineerId: 'invented-engineer', status: options.status ?? 'PREPARED', ignoredAt: null } : null);
      },
    },
    masters: masters.masters,
    nodes: {
      listNodes: (id) => {
        reads.nodes.record(id);
        return Promise.resolve(nodes);
      },
    },
    configuration: {
      current: () => Promise.resolve(current),
      byId: (id) => (id === INVENTED_VERSION_ID ? Promise.resolve(version) : Promise.reject(new Error('Invented: no such version.'))),
    },
  };
  return { service: createEstimateReviewService(dependencies), dependencies, nodes, reads, masters };
}
