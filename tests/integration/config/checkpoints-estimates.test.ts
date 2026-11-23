import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { findFieldByKey } from '@/lib/fields/registry';
import { systemClock } from '@/lib/time';
import { createConfigCheckpointRepository } from '@/server/repositories/config-checkpoint-repository';
import { createConfigRepository } from '@/server/repositories/config-repository';
import { createImageRepository } from '@/server/repositories/image-repository';
import { createConfigCheckpointService, type ConfigCheckpointService } from '@/server/services/config-checkpoint-service';
import { createConfigEditService, type ConfigEditCaller, type ConfigEditService } from '@/server/services/config-edit-service';
import { createConfigStructureService, type ConfigStructureService } from '@/server/services/config-structure-service';
import { createConfigVersionCache, getCurrentVersion, getVersionById } from '@/server/services/config-service';
import { createEstimateService, type EstimateService, type EstimateViewer } from '@/server/services/estimate-service';
import { createStepUpService } from '@/server/services/step-up-service';

import { currentCalculationOf, engineerOf, leadOf, PRICE, requestFor } from '../../support/approval-helpers';
import { approvedValuesOf, calculatedEstimateOf, exportCellsOf, openApprovedWorld, summaryWithoutMarker, type ApprovedWorld } from '../../support/approved-world';
import { KEY_SECRET } from '../../support/audit-database';
import { createTestHasher } from '../../support/builders/user';
import { defined } from '../../support/defined';
import { inputAfterAx } from '../../support/insert-specs';
import { seedConfig, seedFieldAt } from '../../support/seed-config';

/**
 * STORY-08.06 AC-6 (FR-078, FR-077; SPEC section 14 item 8) against real PostgreSQL in a throwaway database, through the real services and the pinning harness of STORY-08.05: **a revert touches no estimate data**.
 * A checkpoint is saved on version 1; an estimate is calculated and approved on it, and a Draft holds a value in a field a later version inserts; then the Admin's own services store three more versions (a formula
 * saved, an input inserted, Part No. deleted) and the Admin reverts to the checkpoint (version 5, a copy of version 1). The rows and the content hashes of the estimates, nodes, calculations, calculation rows, approvals,
 * the masters and the images are compared before and after the revert, and what the approved estimate shows and exports (SCR-06, SCR-07, the records and every cell of the file) is deep-equal to what it was. A Draft uses
 * the reverted layout from its next calculation, and a Draft that holds a value for a field the reverted layout lacks still opens. Every name, ID and password is invented.
 */

let world: ApprovedWorld;
let estimates: EstimateService;
let edit: ConfigEditService;
let structure: ConfigStructureService;
let checkpoints: ConfigCheckpointService;
let admin: ConfigEditCaller;

const RIGHT = 'Tn4#vLm8@Qz-right';
const AL = seedFieldAt('AL');
const PART_NO = defined(findFieldByKey(seedConfig, 'part-no'));
const configurations = () => createConfigRepository(world.db.prisma);
/** The tables a revert must leave exactly as they are. */
const UNTOUCHED = ['estimates', 'estimate_nodes', 'calculations', 'calculation_rows', 'approvals', 'process_items', 'materials', 'exchange_rates', 'treatments', 'customers', 'customer_rates', 'part_images'] as const;

const made = { approved: '', draft: '' };
let checkpointVersionId = '';
let insertedId = '';
let approvedBefore: Awaited<ReturnType<typeof approvedValuesOf>>;
let formBefore: Awaited<ReturnType<EstimateService['getForm']>>;
let summaryBefore: unknown;
let cellsBefore: Awaited<ReturnType<typeof exportCellsOf>>;

const lead = (): EstimateViewer => leadOf(world.db);
const engineer = (): EstimateViewer => engineerOf(world.db);

/** The row count and a hash of the content of each table that must not change, so "holds exactly the rows and content hashes they held" is a comparison and not a feeling. */
async function fingerprint(): Promise<Record<string, { n: number; hash: string }>> {
  const result: Record<string, { n: number; hash: string }> = {};
  for (const table of UNTOUCHED) {
    const { rows } = await world.db.owner.query<{ n: number; hash: string }>(`SELECT count(*)::int AS n, coalesce(md5(string_agg(t::text, '|' ORDER BY t::text)), '') AS hash FROM "${table}" t`);
    result[table] = defined(rows[0]);
  }
  return result;
}

const versionNumbers = async (): Promise<number[]> => (await world.db.owner.query<{ number: number }>('SELECT number FROM config_versions ORDER BY number')).rows.map((row) => row.number);
const latestNumber = async (): Promise<number> => defined((await versionNumbers()).at(-1));
const fieldIdsOf = (form: Awaited<ReturnType<EstimateService['getForm']>>): string[] => form.sections.flatMap((section) => section.fields.map((field) => field.id));

beforeAll(async () => {
  world = await openApprovedWorld();
  const { db } = world;
  const cache = createConfigVersionCache();
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
  checkpoints = createConfigCheckpointService({
    configurations: configurations(),
    checkpoints: createConfigCheckpointRepository(db.prisma),
    masters: db.masterRepository,
    stepUp,
    transactions: db.transactions,
    audit: db.audit,
    cache: createConfigVersionCache(),
  });
  await db.owner.query('UPDATE users SET password_hash = $1 WHERE id = $2::uuid', [await createTestHasher().hash(RIGHT), world.admin.actorId]);
  admin = { user: { id: world.admin.actorId, name: world.admin.actorLabel, role: 'ADMIN' }, requestId: 'req-0000beef' };

  // Version 1: the checkpoint, an approved estimate and a Draft.
  checkpointVersionId = (await checkpoints.saveCheckpoint(admin, { name: 'Invented Before Edits' })).versionId;
  const calculated = await calculatedEstimateOf(world);
  made.approved = calculated.estimateId;
  await db.owner.query('UPDATE estimate_nodes SET inputs = inputs || jsonb_build_object($1::text, $2::text) WHERE estimate_id = $3::uuid', [PART_NO.id, 'Invented-PN-0001', made.approved]);
  await world.db.approvalService.approve(world.lead, made.approved, requestFor(db, await currentCalculationOf(db, made.approved), PRICE));
  // A Draft with two parts (the status of a calculated estimate is put back to Draft, as an unlock leaves it): it has a calculation on version 1 and parts that hold typed values.
  made.draft = (await calculatedEstimateOf(world)).estimateId;
  await db.owner.query("UPDATE estimates SET status = 'DRAFT' WHERE id = $1::uuid", [made.draft]);
  approvedBefore = await approvedValuesOf(world, made.approved);
  summaryBefore = await summaryWithoutMarker(world, made.approved);
  formBefore = await estimates.getForm(lead(), made.approved);
  cellsBefore = await exportCellsOf(world, made.approved);

  // Versions 2, 3 and 4, made by the Admin's services: a formula saved, an input inserted, Part No. deleted.
  await edit.saveFormula(admin, AL.id, { text: 'P * Cutting-Rate-per-Sec * 2', password: RIGHT, baseVersion: await latestNumber() });
  await structure.insertFields(admin, { spec: inputAfterAx({ label: 'Invented Revert Notch Count', defaultValue: '1' }), baseVersion: await latestNumber() });
  const latest = await getCurrentVersion(configurations(), createConfigVersionCache());
  insertedId = defined(latest.document.fields.find((field) => field.label === 'Invented Revert Notch Count')).id;
  await structure.deleteField(admin, PART_NO.id, { password: RIGHT });
  // The Draft holds a value in the field the reverted layout will lack.
  const draftNodes = await db.nodes.listNodes(made.draft);
  for (const node of draftNodes) await db.owner.query('UPDATE estimate_nodes SET inputs = inputs || jsonb_build_object($1::text, $2::text) WHERE id = $3::uuid', [insertedId, '7', node.id]);
}, 240_000);

afterAll(async () => {
  await world.db.close();
});

describe('AC-6: a revert touches no estimate data', () => {
  it('stores version 5 as a copy of version 1, and the rows and content hashes of every estimate, calculation, approval, master and image are what they were', async () => {
    expect(await versionNumbers()).toEqual([1, 2, 3, 4]);
    const before = await fingerprint();
    // The change is real: the layout of version 4 is not the one of version 1.
    expect(fieldIdsOf(await estimates.getForm(engineer(), made.draft))).toContain(insertedId);
    const answer = await checkpoints.revert(admin, checkpointVersionId, { password: RIGHT, baseVersion: 4 });
    expect(answer).toMatchObject({ version: 5, copiedFrom: 1 });
    expect(await versionNumbers()).toEqual([1, 2, 3, 4, 5]);
    const { rows } = await world.db.owner.query<{ same: boolean }>('SELECT (a.snapshot = b.snapshot) AS same FROM config_versions a, config_versions b WHERE a.number = 5 AND b.number = 1');
    expect(rows).toEqual([{ same: true }]);
    expect(await fingerprint()).toEqual(before);
  });

  it('the approved estimate shows and exports its original values and layout: SCR-06, SCR-07, the records, the summary and every cell of the file are deep-equal, still on version 1', async () => {
    const after = await approvedValuesOf(world, made.approved);
    expect(after.costs.configurationNumber).toBe(1);
    expect(after).toEqual(approvedBefore);
    expect(await summaryWithoutMarker(world, made.approved)).toEqual(summaryBefore);
    expect(await exportCellsOf(world, made.approved)).toEqual(cellsBefore);
  });

  it('the approved estimate\'s form is the one it was approved with, for every role', async () => {
    expect((await estimates.getForm(lead(), made.approved)).sections).toEqual(formBefore.sections);
    expect((await estimates.getForm(engineer(), made.approved)).sections).toEqual(formBefore.sections);
  });

  it('a Draft uses the reverted layout: Part No. is back on its form and the inserted input is gone', async () => {
    const ids = fieldIdsOf(await estimates.getForm(engineer(), made.draft));
    expect(ids).toContain(PART_NO.id);
    expect(ids).not.toContain(insertedId);
  });

  it('a Draft that holds a value for a field the reverted layout lacks still opens, and its part keeps the value', async () => {
    const node = defined((await world.db.nodes.listNodes(made.draft))[0]);
    // The part opens (the registry it is read through no longer knows the field, which is skipped) and the stored value is still there, for a later revert or a later insert to find.
    expect((await estimates.getNode(engineer(), made.draft, node.id)).inputs).not.toHaveProperty(insertedId);
    const stored = await world.db.owner.query<{ value: string }>('SELECT inputs ->> $2 AS value FROM estimate_nodes WHERE id = $1::uuid', [node.id, insertedId]);
    expect(stored.rows).toEqual([{ value: '7' }]);
  });

  it('a calculation made after the revert names version 5 and gives the figures version 1 gives, which the later versions did not', async () => {
    const fresh = await calculatedEstimateOf(world);
    const costs = await world.review.getCosts(world.lead, fresh.estimateId);
    expect(costs.configurationNumber).toBe(5);
    expect(defined(costs.totals).totalPrice).toBe(defined(approvedBefore.costs.totals).totalPrice);
  });
});
