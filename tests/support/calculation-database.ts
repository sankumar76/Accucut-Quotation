import { randomUUID } from 'node:crypto';

import { createCalculationRepository, type CalculationRepository } from '../../src/server/repositories/calculation-repository';
import { createEstimateRepository, type EstimateRepository } from '../../src/server/repositories/estimate-repository';
import { createCalculationService, type CalculationNodeRequest, type CalculationService, type CalculationServiceDependencies } from '../../src/server/services/calculation-service';

import { insertPersonAsOwner, openAuditDatabase, type AuditDatabase } from './audit-database';
import { defined } from './defined';
import { EXCHANGE, MATERIAL, ROW, TYPED_RATES } from './row-oracle';
import { SEED_PROCESS_ITEMS, seedConfig, seedFieldAt } from './seed-config';

/**
 * A throwaway migrated database with everything a stored calculation needs (STORY-03.05): a configuration version, a person, a customer with rates, two materials,
 * both exchange rates, and helpers that add an estimate in any state. The calculation tables cannot be emptied, even by the owner, so each test file opens a database of
 * its own and drops it (test strategy section 4) and each test makes its own estimate. Every name and number is invented.
 */

export const idOf = (letter: string): string => seedFieldAt(letter).id;
export const typedRow = (): Record<string, string> => Object.fromEntries(Object.entries(ROW).map(([letter, text]) => [idOf(letter), text]));

const UNC_PATH = '\\\\invented-server\\invented-share\\RFQ-1';
const MATERIAL_TWO = { pricePerKg: '90.5', specificGravity: '2.7', scrapRate: '40' } as const;

export interface CalculationDatabase extends AuditDatabase {
  readonly calculations: CalculationRepository;
  readonly estimates: EstimateRepository;
  readonly service: CalculationService;
  /** The same service over the real repositories with some of its storage replaced, for a test of a failure part-way. */
  buildService(storage?: Partial<NonNullable<CalculationServiceDependencies['storage']>>): CalculationService;
  readonly personId: string;
  readonly configVersionId: string;
  readonly customerId: string;
  /** The two materials, by the names the tests rename. */
  readonly materialOneId: string;
  readonly materialTwoId: string;
  /** A new task and estimate for the customer, in this state. */
  addEstimate(options?: { status?: 'DRAFT' | 'SUBMITTED' | 'APPROVED'; withCustomer?: boolean; revision?: number }): Promise<string>;
  /** A node of the invented row, with its own ID. */
  node(overrides?: Partial<CalculationNodeRequest>): CalculationNodeRequest;
}

let taskNumber = 0;

export async function openCalculationDatabase(): Promise<CalculationDatabase> {
  const db = await openAuditDatabase();
  const personId = await insertPersonAsOwner(db, 'Calculation Lead', 'LEAD');

  const version = await db.owner.query<{ id: string }>(`INSERT INTO config_versions (number, snapshot, reason) VALUES (1, $1::jsonb, 'Invented seed') RETURNING id::text`, [
    JSON.stringify(seedConfig),
  ]);
  const configVersionId = defined(version.rows[0]).id;

  const customer = await db.owner.query<{ id: string }>("INSERT INTO customers (name) VALUES ('Invented calculation customer') RETURNING id::text");
  const customerId = defined(customer.rows[0]).id;
  for (const item of SEED_PROCESS_ITEMS) {
    await db.owner.query('INSERT INTO customer_rates (customer_id, process_item_id, value) VALUES ($1::uuid, $2::uuid, $3)', [customerId, item.id, defined(TYPED_RATES[item.name], item.name)]);
  }

  const material = async (name: string, considered: string, values: { pricePerKg: string; specificGravity: string; scrapRate: string }): Promise<string> => {
    const { rows } = await db.owner.query<{ id: string }>(
      `INSERT INTO materials (material_in_drawing, material_considered, price_per_kg, specific_gravity, scrap_rate) VALUES ($1, $2, $3, $4, $5) RETURNING id::text`,
      [name, considered, values.pricePerKg, values.specificGravity, values.scrapRate],
    );
    return defined(rows[0]).id;
  };
  const materialOneId = await material('Invented plate', 'Invented steel', MATERIAL);
  const materialTwoId = await material('Invented bar', 'Invented alloy', MATERIAL_TWO);
  await db.owner.query("INSERT INTO exchange_rates (currency, inr_value, updated_by) VALUES ('USD', $1, $3::uuid), ('EUR', $2, $3::uuid)", [EXCHANGE.usd, EXCHANGE.eur, personId]);

  const calculations = createCalculationRepository(db.prisma);
  const estimates = createEstimateRepository(db.prisma);
  const buildService = (storage: Partial<NonNullable<CalculationServiceDependencies['storage']>> = {}): CalculationService =>
    createCalculationService({
      masters: db.masterRepository,
      currentConfiguration: () => Promise.resolve({ id: configVersionId, document: seedConfig }),
      storage: { calculations, estimates, transactions: db.transactions, ...storage },
    });

  return {
    ...db,
    calculations,
    estimates,
    service: buildService(),
    buildService,
    personId,
    configVersionId,
    customerId,
    materialOneId,
    materialTwoId,
    async addEstimate(options = {}) {
      taskNumber += 1;
      const task = await db.owner.query<{ id: string }>(
        `INSERT INTO tasks (code, engineer_id, assigned_by, folder_path, deadline_at) VALUES ($1, $2::uuid, $2::uuid, $3, now() + interval '3 days') RETURNING id::text`,
        [`Q-2026-${String(9000 + taskNumber)}`, personId, UNC_PATH],
      );
      const { rows } = await db.owner.query<{ id: string }>(
        `INSERT INTO estimates (task_id, customer_id, status, inputs_revision) VALUES ($1::uuid, $2::uuid, $3::estimate_status, $4) RETURNING id::text`,
        [defined(task.rows[0]).id, options.withCustomer === false ? null : customerId, options.status ?? 'DRAFT', options.revision ?? 3],
      );
      return defined(rows[0]).id;
    },
    node: (overrides = {}) => ({
      nodeId: randomUUID(),
      parentId: null,
      sortIndex: 0,
      slNo: '1',
      imageId: null,
      materialId: materialOneId,
      inputs: typedRow(),
      texts: { [idOf('G')]: 'Invented powder coat, grey', [idOf('AJ')]: 'Invented remark' },
      ...overrides,
    }),
  };
}
