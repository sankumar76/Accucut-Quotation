/**
 * Makes the data that the Lighthouse run measures against (NFR-009; G8-C-NFR9, DL-251; PRD NFR-011 planning volume): 500 customers with a rate for each of 50 Process Master items
 * (25,000 rate rows), 200 materials, the two exchange rates, a Lead, 25 Engineers with 300 tasks and estimates for the queue and the assign screen, and two estimates of the measurement
 * Engineer with the `tree500` fixture (500 parts): one a Draft for the workspace screen, one calculated through the portal for the cost-details screen. Every name and number is invented.
 * It is made for the key screens of `lighthouserc.cjs`, not for the E2E suite, which has its own data.
 *
 * Needs the migrated database with the seed configuration version (`ensure-seed-version.ts`), the measurement Admin (`ensure-measurement-user.ts`) and the production server running
 * (Calculate is pressed through it). Reads `DATABASE_URL`, `LHCI_BASE_URL`, `MEASUREMENT_ENGINEER_EMAIL` and `MEASUREMENT_ENGINEER_PASSWORD` (invented; the job makes the password). It runs only
 * against a throwaway database (`assertThrowawayDatabase`), makes the Engineer with a cheap password hash, and prints no password. Run it once on a fresh database; it stops if the data is there.
 *
 * Usage: node --conditions=react-server --import tsx scripts/seed-lighthouse-data.ts
 * (the condition is needed because the fixture imports the formula engine, whose files start with `import 'server-only'`; see `ensure-seed-version.ts`).
 */
import { randomBytes, randomUUID } from 'node:crypto';

import { buildTree500 } from '../tests/support/builders/tree500';
import { completePartInputs } from '../tests/support/complete-part';

import { loadDatabaseEnv } from '../src/lib/env';
import { createPasswordHasher } from '../src/server/auth/password-hasher';
import { createPrismaClient } from '../src/server/repositories/prisma-client';
import { createUserRepository } from '../src/server/repositories/user-repository';

import {
  COST_CODE,
  CUSTOMER_COUNT,
  FOLDER_PATH,
  INVENTED_EXCHANGE_RATES,
  INVENTED_MATERIAL,
  INVENTED_RATE,
  MATERIAL_COUNT,
  PROCESS_ITEM_TOTAL,
  QUEUE_CODE_PREFIX,
  QUEUE_ENGINEER_COUNT,
  QUEUE_TASK_COUNT,
  SEED_PROCESS_ITEM_COUNT,
  WORKSPACE_CODE,
  leadEmail,
  queueEngineerEmail,
} from './lib/lighthouse-data';
import { MeasurementUserError, assertThrowawayDatabase } from './lib/measurement-user';
import { calculateOverHttp, signInOverHttp } from './lib/portal-calculate';

type Client = ReturnType<typeof createPrismaClient>;

/** A small argon2id cost: these people exist for one run, and their passwords are invented or thrown away. */
const HASH_COST = { memoryCost: 64, timeCost: 1, parallelism: 1 } as const;

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') throw new MeasurementUserError(`${name} is not set`);
  return value;
}

interface People {
  readonly leadId: string;
  readonly engineerIds: ReadonlyArray<string>;
  readonly measurementEngineerId: string;
}

async function seedPeople(client: Client, engineer: { readonly email: string; readonly password: string }): Promise<People> {
  const users = createUserRepository(client);
  const hasher = createPasswordHasher(HASH_COST);
  // One throwaway password for everyone who never signs in; only the measurement Engineer's is the job's.
  const unusedHash = await hasher.hash(randomBytes(16).toString('hex'));
  const make = (name: string, email: string, role: 'LEAD' | 'ENGINEER', passwordHash: string): Promise<string> =>
    users.create({ name, email, passwordHash, role, mustChangePassword: false });
  const leadId = await make('Measurement Lead', leadEmail(), 'LEAD', unusedHash);
  const engineerIds: string[] = [];
  for (let n = 1; n <= QUEUE_ENGINEER_COUNT; n += 1) engineerIds.push(await make(`Measurement Engineer ${n}`, queueEngineerEmail(n), 'ENGINEER', unusedHash));
  const measurementEngineerId = await make('Measurement Engineer', engineer.email, 'ENGINEER', await hasher.hash(engineer.password));
  return { leadId, engineerIds, measurementEngineerId };
}

/** The masters at the planning volume. Returns the first customer's ID and the first material's, which the two estimates use. */
async function seedMasters(client: Client, leadId: string): Promise<{ readonly customerId: string; readonly materialId: string }> {
  const extraItems = PROCESS_ITEM_TOTAL - SEED_PROCESS_ITEM_COUNT;
  await client.$executeRaw`INSERT INTO process_items (name, unit, default_value)
    SELECT 'Invented process item ' || lpad(g::text, 2, '0'), 'per unit', ${INVENTED_RATE}::numeric FROM generate_series(1, ${extraItems}::int) g ON CONFLICT DO NOTHING`;
  await client.$executeRaw`INSERT INTO customers (name) SELECT 'Invented customer ' || lpad(g::text, 4, '0') FROM generate_series(1, ${CUSTOMER_COUNT}::int) g ON CONFLICT DO NOTHING`;
  // One rate for every item of every customer (SPEC section 4.2 rule 1): 500 x 50 = 25,000 rows. The 15 seed items have a default of 0, so their rate here is typed, as an Admin types it.
  await client.$executeRaw`INSERT INTO customer_rates (customer_id, process_item_id, value)
    SELECT c.id, p.id, ${INVENTED_RATE}::numeric FROM customers c CROSS JOIN process_items p WHERE c.name LIKE 'Invented customer %' ON CONFLICT DO NOTHING`;
  await client.$executeRaw`INSERT INTO materials (material_in_drawing, material_considered, price_per_kg, specific_gravity, scrap_rate)
    SELECT 'Invented material ' || lpad(g::text, 3, '0'), 'Invented material ' || lpad(g::text, 3, '0'),
           ${INVENTED_MATERIAL.pricePerKg}::numeric, ${INVENTED_MATERIAL.specificGravity}::numeric, ${INVENTED_MATERIAL.scrapRate}::numeric
    FROM generate_series(1, ${MATERIAL_COUNT}::int) g ON CONFLICT DO NOTHING`;
  for (const rate of INVENTED_EXCHANGE_RATES) {
    await client.$executeRaw`INSERT INTO exchange_rates (currency, inr_value, updated_by) VALUES (${rate.currency}, ${rate.inrValue}::numeric, ${leadId}::uuid) ON CONFLICT DO NOTHING`;
  }
  const customers = await client.$queryRaw<ReadonlyArray<{ id: string }>>`SELECT id::text AS id FROM customers WHERE name = 'Invented customer 0001'`;
  const materials = await client.$queryRaw<ReadonlyArray<{ id: string }>>`SELECT id::text AS id FROM materials WHERE material_in_drawing = 'Invented material 001'`;
  const customerId = customers[0]?.id;
  const materialId = materials[0]?.id;
  if (customerId === undefined || materialId === undefined) throw new MeasurementUserError('the first invented customer or material is missing after it was inserted');
  return { customerId, materialId };
}

/** The tasks of the queue and the assign screen, each with its estimate, round the queue's Engineers. */
async function seedQueue(client: Client, people: People): Promise<void> {
  await client.$executeRaw`INSERT INTO tasks (code, engineer_id, assigned_by, folder_path, deadline_at, title, notes)
    SELECT ${QUEUE_CODE_PREFIX} || lpad(g::text, 4, '0'), (${people.engineerIds}::uuid[])[1 + (g % ${people.engineerIds.length}::int)], ${people.leadId}::uuid, ${FOLDER_PATH},
           now() + make_interval(hours => g), 'Invented task ' || g, 'Invented notes.'
    FROM generate_series(1, ${QUEUE_TASK_COUNT}::int) g ON CONFLICT DO NOTHING`;
  await client.$executeRaw`INSERT INTO estimates (task_id) SELECT t.id FROM tasks t WHERE t.code LIKE ${`${QUEUE_CODE_PREFIX}%`} ON CONFLICT DO NOTHING`;
}

/** A task and estimate of the measurement Engineer with the 500 parts of the `tree500` fixture, every part complete (a Calculate takes the whole path). Returns the estimate's ID. */
async function seedTree500Estimate(
  client: Client,
  input: { readonly code: string; readonly engineerId: string; readonly leadId: string; readonly customerId: string; readonly materialId: string },
): Promise<string> {
  const taskId = randomUUID();
  const estimateId = randomUUID();
  const base = { ...completePartInputs(undefined, input.materialId) };
  const tree = buildTree500();
  const ids: string[] = [];
  const nextPlace = new Map<number | null, number>();
  await client.$transaction(async (tx) => {
    await tx.$executeRaw`INSERT INTO tasks (id, code, engineer_id, assigned_by, folder_path, deadline_at, title, notes)
      VALUES (${taskId}::uuid, ${input.code}, ${input.engineerId}::uuid, ${input.leadId}::uuid, ${FOLDER_PATH}, now() + interval '30 days', 'Invented estimate of 500 parts', 'Invented notes.')`;
    await tx.$executeRaw`INSERT INTO estimates (id, task_id, customer_id) VALUES (${estimateId}::uuid, ${taskId}::uuid, ${input.customerId}::uuid)`;
    for (const node of tree.nodes) {
      const sortIndex = nextPlace.get(node.parentIndex) ?? 0;
      nextPlace.set(node.parentIndex, sortIndex + 1);
      const typed = Object.fromEntries([...node.inputs].map(([fieldId, value]) => [fieldId, value.toFixed(2)]));
      const id = randomUUID();
      const parentId = node.parentIndex === null ? null : (ids[node.parentIndex] ?? null);
      ids.push(id);
      await tx.$executeRaw`INSERT INTO estimate_nodes (id, estimate_id, parent_id, sort_index, inputs)
        VALUES (${id}::uuid, ${estimateId}::uuid, ${parentId}::uuid, ${sortIndex}::int, ${JSON.stringify({ ...base, ...typed })}::jsonb)`;
    }
  });
  return estimateId;
}

async function isSeeded(client: Client): Promise<boolean> {
  const rows = await client.$queryRaw<ReadonlyArray<{ found: boolean }>>`SELECT EXISTS (SELECT 1 FROM tasks WHERE code = ${WORKSPACE_CODE}) AS found`;
  return rows[0]?.found === true;
}

async function run(): Promise<void> {
  const engineer = { email: required('MEASUREMENT_ENGINEER_EMAIL'), password: required('MEASUREMENT_ENGINEER_PASSWORD') };
  const origin = (process.env['LHCI_BASE_URL'] ?? 'http://localhost:3000').replace(/\/+$/, '');
  const { DATABASE_URL } = loadDatabaseEnv();
  assertThrowawayDatabase(DATABASE_URL, process.env['NODE_ENV']);
  const client = createPrismaClient('script', DATABASE_URL);
  try {
    if (await isSeeded(client)) {
      process.stdout.write('seed-lighthouse-data: the data is already there; nothing was changed.\n');
      return;
    }
    const people = await seedPeople(client, engineer);
    const { customerId, materialId } = await seedMasters(client, people.leadId);
    await seedQueue(client, people);
    const common = { engineerId: people.measurementEngineerId, leadId: people.leadId, customerId, materialId };
    await seedTree500Estimate(client, { ...common, code: WORKSPACE_CODE });
    const costEstimateId = await seedTree500Estimate(client, { ...common, code: COST_CODE });
    // Calculate takes the whole path for 500 parts, as the Engineer's button does; the estimate is then Submitted and its cost details open for the Lead and the Admin.
    await calculateOverHttp(origin, await signInOverHttp(origin, engineer.email, engineer.password), costEstimateId);
    process.stdout.write('seed-lighthouse-data: the data was made (500 customers, 25,000 rates, 200 materials, 300 queue tasks, two estimates of 500 parts, one calculated).\n');
  } finally {
    await client.$disconnect();
  }
}

run().catch((error: unknown) => {
  // The job log is public: the message is cut short and the database address, if a driver put it there, is taken out.
  const message = error instanceof Error ? error.message : 'unexpected error';
  const address = process.env['DATABASE_URL'] ?? '';
  process.stderr.write(`seed-lighthouse-data failed: ${(address === '' ? message : message.split(address).join('(database)')).slice(0, 600)}\n`);
  process.exitCode = 1;
});
