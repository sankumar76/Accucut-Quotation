import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { findFieldByKey } from '@/lib/fields/registry';
import { systemClock } from '@/lib/time';
import { createConfigRepository } from '@/server/repositories/config-repository';
import { createImageRepository } from '@/server/repositories/image-repository';
import { createCancelApprovalService } from '@/server/services/cancel-approval-service';
import { createConfigEditService, type ConfigEditCaller, type ConfigEditService } from '@/server/services/config-edit-service';
import { createConfigStructureService, type ConfigStructureService } from '@/server/services/config-structure-service';
import { createConfigVersionCache, getCurrentVersion, getVersionById } from '@/server/services/config-service';
import { createEstimateService, type EstimateService, type EstimateViewer } from '@/server/services/estimate-service';
import { createStepUpService } from '@/server/services/step-up-service';

import { adminOf, auditOf, currentCalculationOf, engineerOf, leadOf, PRICE, requestFor } from '../../support/approval-helpers';
import { approvedValuesOf, calculatedEstimateOf, exportCellsOf, openApprovedWorld, type ApprovedWorld } from '../../support/approved-world';
import { KEY_SECRET } from '../../support/audit-database';
import { createTestHasher } from '../../support/builders/user';
import { defined } from '../../support/defined';
import { inputAfterAx } from '../../support/insert-specs';
import { seedConfig, seedFieldAt } from '../../support/seed-config';

/**
 * STORY-08.05 AC-3 to AC-6 (FR-077, FR-065; SPEC section 8.4 and section 14 item 8) against real PostgreSQL in a throwaway database, as the runtime role, through the real services: estimates are calculated on
 * version 1 (an approved one, one unlocked, one whose approval was cancelled, a Prepared one, a new Draft), then **the Admin's own screens' services store three more versions** (a formula saved, an input inserted
 * after AX, Part No. deleted), and what each estimate shows and stores is read again.
 *
 * - AC-3: the bar line of SCR-06 names the calculation's version, not the latest; the unlock preview reads "1 to 4"; "estimates in use" is the count of estimates whose current calculation uses the version.
 * - AC-4: the approved estimate's figures, letters, stage layout, cost details, records and **every cell of the downloaded file** are identical to what they were, to the last digit (`approvedValuesOf`).
 * - AC-5: its form is the one it was approved with (the deleted field is on it with the stored value, the inserted one is not), and every other estimate's form is the latest.
 * - AC-6: a Recalculate names the latest version and uses the new formula; until then an unlocked Draft still shows its approved figures on the version they were made with.
 *
 * Each test first shows that the change **did** change what a calculation made now would give, so a pass cannot come from a change that changed nothing. Every name, ID and password is invented.
 */

let world: ApprovedWorld;
let estimates: EstimateService;
let edit: ConfigEditService;
let structure: ConfigStructureService;
let admin: ConfigEditCaller;

const RIGHT = 'Tn4#vLm8@Qz-right';
const AL = seedFieldAt('AL');
const PART_NO = defined(findFieldByKey(seedConfig, 'part-no'));
const STORED_PART_NO = 'Invented-PN-0001';
const configurations = () => createConfigRepository(world.db.prisma);

/** The estimates of the file. `approved` stays approved; the others were approved first and then unlocked or cancelled, so each holds a calculation made on version 1. */
const made: { approved: string; unlocked: string; cancelled: string; prepared: string; fresh: string } = { approved: '', unlocked: '', cancelled: '', prepared: '', fresh: '' };
/** What the approved estimate showed and stored, and its form, before any later version existed. */
let before: Awaited<ReturnType<typeof approvedValuesOf>>;
let formBefore: Awaited<ReturnType<EstimateService['getForm']>>;
let partOfApproved: string;
let unlockedBefore: { costs: unknown; nodeCosts: unknown; summary: unknown };
let summaryBefore: unknown;
let firstVersionId: string;

const engineer = (): EstimateViewer => engineerOf(world.db);
const lead = (): EstimateViewer => leadOf(world.db);
const viewers = (): ReadonlyArray<readonly [string, EstimateViewer]> => [
  ['Engineer', engineer()],
  ['Lead', lead()],
  ['Admin', adminOf(world.db)],
];

async function versionNumbers(): Promise<number[]> {
  const { rows } = await world.db.owner.query<{ number: number }>('SELECT number FROM config_versions ORDER BY number');
  return rows.map((row) => row.number);
}
const latestNumber = async (): Promise<number> => defined((await versionNumbers()).at(-1));

/** A calculated estimate with a value in Part No. (the field the later version deletes), then approved. */
async function approvedWithPartNo(): Promise<{ estimateId: string; nodeIds: ReadonlyArray<string> }> {
  const calculated = await calculatedEstimateOf(world);
  await world.db.owner.query('UPDATE estimate_nodes SET inputs = inputs || jsonb_build_object($1::text, $2::text) WHERE estimate_id = $3::uuid', [PART_NO.id, STORED_PART_NO, calculated.estimateId]);
  const calculationId = await currentCalculationOf(world.db, calculated.estimateId);
  await world.db.approvalService.approve(world.lead, calculated.estimateId, requestFor(world.db, calculationId, PRICE));
  return { estimateId: calculated.estimateId, nodeIds: calculated.nodeIds };
}

const unlock = (estimateId: string) => world.unlock.unlock(world.lead, estimateId, { reason: 'Invented unlock', audit: auditOf(world.db) });

async function cancelApproval(estimateId: string): Promise<void> {
  const cancelling = createCancelApprovalService({
    estimates: world.db.estimates,
    approvals: world.db.approvals,
    transactions: world.db.transactions,
    stepUp: { verifyStepUp: () => Promise.resolve() },
    workflow: { transition: world.db.estimateService.transition, audit: world.db.audit },
  });
  const { rows } = await world.db.owner.query<{ id: string }>('SELECT id::text FROM approvals WHERE estimate_id = $1::uuid AND removed_at IS NULL ORDER BY approved_at DESC, id DESC LIMIT 1', [estimateId]);
  await cancelling.cancel(adminOf(world.db), estimateId, { approvalId: defined(rows[0]).id, reason: 'Invented cancel', password: RIGHT, audit: auditOf(world.db) });
}

beforeAll(async () => {
  world = await openApprovedWorld();
  const { db } = world;
  const cache = createConfigVersionCache();
  // The form of an estimate, as the composition wires it: the latest version, and a version by its ID (both cached per version).
  estimates = createEstimateService({
    estimates: db.estimates,
    nodes: db.nodes,
    images: createImageRepository(db.prisma),
    transactions: db.transactions,
    materials: db.masterRepository,
    currentConfiguration: async () => (await getCurrentVersion(configurations(), cache)).document,
    configurationById: async (id) => (await getVersionById(configurations(), id, cache)).document,
  });
  const stepUp = createStepUpService({ users: db.users, throttles: db.throttles, hasher: createTestHasher(), clock: systemClock, keySecret: KEY_SECRET });
  edit = createConfigEditService({ configurations: configurations(), masters: db.masterRepository, calculations: db.calculations, stepUp, transactions: db.transactions, audit: db.audit, cache: createConfigVersionCache() });
  structure = createConfigStructureService({ configurations: configurations(), masters: db.masterRepository, stepUp, transactions: db.transactions, audit: db.audit, cache: createConfigVersionCache() });
  // The world's Admin (the portal has one active Admin) gets a password of its own, so the step-up of a save and a delete is the real one.
  await db.owner.query('UPDATE users SET password_hash = $1 WHERE id = $2::uuid', [await createTestHasher().hash(RIGHT), world.admin.actorId]);
  admin = { user: { id: world.admin.actorId, name: world.admin.actorLabel, role: 'ADMIN' }, requestId: 'req-0000f00d' };
  firstVersionId = db.configVersionId;

  // Version 1: five estimates, each with its calculation made on it.
  const approved = await approvedWithPartNo();
  made.approved = approved.estimateId;
  partOfApproved = defined(approved.nodeIds[0]);
  made.unlocked = (await approvedWithPartNo()).estimateId;
  made.cancelled = (await approvedWithPartNo()).estimateId;
  made.prepared = (await calculatedEstimateOf(world)).estimateId;
  made.fresh = await db.addEstimate({ engineer: true });
  before = await approvedValuesOf(world, made.approved);
  summaryBefore = await world.exporter.getSummary(world.lead, made.approved);
  formBefore = await estimates.getForm(lead(), made.approved);
  await unlock(made.unlocked);
  await cancelApproval(made.cancelled);
  unlockedBefore = {
    costs: await world.review.getCosts(world.lead, made.unlocked),
    nodeCosts: await world.details.getNodeCosts(world.lead, made.unlocked, defined((await db.nodes.listNodes(made.unlocked))[0]).id),
    summary: await world.exporter.getSummary(world.lead, made.unlocked),
  };

  // Versions 2, 3 and 4, made by the Admin's services: a formula saved, an input inserted before BL, a field deleted.
  await edit.saveFormula(admin, AL.id, { text: 'P * Cutting-Rate-per-Sec * 2', password: RIGHT, baseVersion: await latestNumber() });
  await structure.insertFields(admin, { spec: inputAfterAx({ label: 'Invented Pin Notch Count', defaultValue: '1' }), baseVersion: await latestNumber() });
  await structure.deleteField(admin, PART_NO.id, { password: RIGHT });
}, 240_000);

afterAll(async () => {
  await world.db.close();
});

/** The ID of the input the later version inserted, found by its label in the latest version. */
async function insertedFieldId(): Promise<string> {
  const latest = await getCurrentVersion(configurations(), createConfigVersionCache());
  return defined(latest.document.fields.find((field) => field.label === 'Invented Pin Notch Count')).id;
}

const fieldIdsOf = (form: Awaited<ReturnType<EstimateService['getForm']>>): string[] => form.sections.flatMap((section) => section.fields.map((field) => field.id));

describe('AC-3: each estimate records the version it was calculated with', () => {
  it('stores versions 2, 3 and 4 after version 1, with no gap', async () => {
    expect(await versionNumbers()).toEqual([1, 2, 3, 4]);
  });

  it("SCR-06's bar line names the calculation's version (1), not the latest (4); an estimate calculated now names the latest", async () => {
    expect((await world.review.getCosts(world.lead, made.approved)).configurationNumber).toBe(1);
    expect((await world.review.getCosts(world.lead, made.prepared)).configurationNumber).toBe(1);
    const fresh = await calculatedEstimateOf(world);
    expect((await world.review.getCosts(world.lead, fresh.estimateId)).configurationNumber).toBe(4);
  });

  it('the unlock preview of the approved estimate reads "1 to 4": the approval\'s version and the latest', async () => {
    expect((await world.unlock.preview(world.lead, made.approved)).configuration).toEqual({ approved: 1, current: 4 });
  });

  it('"estimates in use" of a version is the number of estimates whose current calculation uses it', async () => {
    const used = async (versionId: string): Promise<number> => {
      const { rows } = await world.db.owner.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM estimates e JOIN calculations c ON c.id = e.current_calculation_id WHERE c.config_version_id = $1::uuid',
        [versionId],
      );
      return defined(rows[0]).n;
    };
    expect(await configurations().readVersionUse(firstVersionId)).toMatchObject({ estimatesInUse: await used(firstVersionId) });
    // Four estimates of the file hold their current calculation on version 1 (approved, unlocked, cancelled, prepared).
    expect((await configurations().readVersionUse(firstVersionId)).estimatesInUse).toBe(4);
  });
});

describe('AC-4 (FR-077, SPEC section 14 item 8): an approved estimate does not change when the configuration does', () => {
  it('the change is real: a calculation made now, with the same kind of inputs, gives another total and other letters', async () => {
    const approvedTotal = defined(before.costs.totals).totalPrice;
    const fresh = await calculatedEstimateOf(world);
    const now = await world.review.getCosts(world.lead, fresh.estimateId);
    expect(defined(now.totals).totalPrice).not.toBe(approvedTotal);
    expect(now.letters).not.toEqual(before.costs.letters);
  });

  it('SCR-06, SCR-07, the records and every cell of the downloaded file are identical to what they were, and still name configuration version 1', async () => {
    const after = await approvedValuesOf(world, made.approved);
    expect(after.costs.configurationNumber).toBe(1);
    expect(after).toEqual(before);
    // SCR-10: the summary (the columns and the cell addresses it names) is the one of version 1 too.
    expect(await world.exporter.getSummary(world.lead, made.approved)).toEqual(summaryBefore);
    // The file is not empty and is the one of version 1: header, two parts, an empty row and the footer, BL2 and BO2 in version 1's columns.
    expect((await exportCellsOf(world, made.approved)).rows).toHaveLength(5);
  });

  it('the figures are the stored ones, not recomputed: the approved estimate holds exactly one calculation, still on version 1', async () => {
    const { rows } = await world.db.owner.query<{ number: number }>(
      'SELECT v.number FROM calculations c JOIN config_versions v ON v.id = c.config_version_id WHERE c.estimate_id = $1::uuid',
      [made.approved],
    );
    expect(rows).toEqual([{ number: 1 }]);
  });
});

describe('AC-5: the form of an approved estimate is pinned; every other form is the latest', () => {
  it.each(['Engineer', 'Lead', 'Admin'])('%s: the approved estimate\'s form is as it was, with the deleted field and without the inserted one, and its part reads back the stored value', async (role) => {
    const viewer = defined(viewers().find(([name]) => name === role))[1];
    const form = await estimates.getForm(viewer, made.approved);
    const ids = fieldIdsOf(form);
    expect(ids).toContain(PART_NO.id);
    expect(ids).not.toContain(await insertedFieldId());
    expect(form.sections).toEqual(formBefore.sections);
    expect((await estimates.getNode(viewer, made.approved, partOfApproved)).inputs).toMatchObject({ [PART_NO.id]: STORED_PART_NO });
  });

  it.each([
    ['a Prepared estimate that was never approved', 'prepared'],
    ['an unlocked Draft whose calculation is on version 1', 'unlocked'],
    ['a Draft after a cancelled approval, whose calculation is on version 1', 'cancelled'],
    ['a new Draft with no calculation', 'fresh'],
  ] as const)('%s reads the latest version: the inserted field is on the form and the deleted one is not', async (_name, key) => {
    const inserted = await insertedFieldId();
    for (const [role, viewer] of viewers()) {
      const ids = fieldIdsOf(await estimates.getForm(viewer, made[key]));
      expect(ids, role).toContain(inserted);
      expect(ids, role).not.toContain(PART_NO.id);
    }
  });

  it('an unlocked estimate that was approved reads the latest at once: the pin ends with the approval', async () => {
    expect(fieldIdsOf(await estimates.getForm(lead(), made.unlocked))).toContain(await insertedFieldId());
    expect(fieldIdsOf(await estimates.getForm(lead(), made.approved))).not.toContain(await insertedFieldId());
  });

  it('answers the Engineer with the same two keys for the pinned form as for any other, and no version number or ID anywhere in it', async () => {
    const form = await estimates.getForm(engineer(), made.approved);
    expect(Object.keys(form).sort()).toEqual(['lastSavedAt', 'sections']);
    const text = JSON.stringify([form, await estimates.getNode(engineer(), made.approved, partOfApproved)]);
    const { rows } = await world.db.owner.query<{ id: string }>('SELECT id::text FROM config_versions');
    for (const row of rows) expect(text).not.toContain(row.id);
    expect(text.toLowerCase()).not.toContain('version');
  });
});

describe('AC-6 (SPEC section 8.4): a new or unlocked estimate uses the latest version when it is calculated again', () => {
  it('until Recalculate an unlocked Draft still shows its approved figures on version 1; after it the new calculation names version 4 and uses the new formula', async () => {
    const { db } = world;
    const costsBefore = await world.review.getCosts(world.lead, made.unlocked);
    expect(costsBefore.configurationNumber).toBe(1);
    expect(costsBefore.state).toBe('current');
    expect(costsBefore).toEqual(unlockedBefore.costs);
    expect(await world.exporter.getSummary(world.lead, made.unlocked)).toEqual(unlockedBefore.summary);
    expect(await world.details.getNodeCosts(world.lead, made.unlocked, defined((await db.nodes.listNodes(made.unlocked))[0]).id)).toEqual(unlockedBefore.nodeCosts);

    const inUseBefore = (await configurations().readVersionUse(firstVersionId)).estimatesInUse;
    await db.service.calculate(engineer(), made.unlocked);
    const costsAfter = await world.review.getCosts(world.lead, made.unlocked);
    expect(costsAfter.configurationNumber).toBe(4);
    // The formula of AL was doubled in version 2, so the same parts give another total.
    expect(defined(costsAfter.totals).totalPrice).not.toBe(defined(costsBefore.totals).totalPrice);
    // The estimate left version 1: one fewer estimate uses it.
    expect((await configurations().readVersionUse(firstVersionId)).estimatesInUse).toBe(inUseBefore - 1);
  });

  it('the approved estimate and its unlock preview are untouched by that Recalculate of another estimate', async () => {
    expect(await approvedValuesOf(world, made.approved)).toEqual(before);
    expect((await world.unlock.preview(world.lead, made.approved)).configuration).toEqual({ approved: 1, current: 4 });
  });
});
