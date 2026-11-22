import { z } from 'zod';

import { jsonOf, mustCall, type Session } from './client';
import type { LoadConfig } from './config';
import {
  CHANGED_RATE,
  CHANGED_RATES_PER_CUSTOMER,
  CUSTOMER_CHANGE_EVERY,
  INVENTED_EXCHANGE_RATES,
  INVENTED_MATERIAL,
  INVENTED_RATE,
  customerName,
  customerShortName,
  mapLimit,
  materialName,
  processItemName,
  treatmentName,
} from './plan';

/**
 * The master data of the volume check (test strategy 8.1; NFR-011), made through the public API as the invented Admin: the two exchange rates, 35 Process Master items on top of the 15 the
 * migration makes, 500 customers (each given its 50 rates at their defaults by the service: 25,000 rate rows), five changed rates on every fifth customer, 200 materials and 50 Treatment / Color
 * entries. The order matters: a new Process Master item adds one rate row to every customer that exists (FR-012, FR-013), so the items go in first. A kind that is already there at the wanted
 * size is left alone, so a second run on the same database does not add to it. The seeding runs a few calls at once; the order inside each kind does not matter.
 */

const SEED_CONCURRENCY = 6;
const CREATED = 201;
const OK = 200;

const idOnly = z.object({ id: z.string().min(1) });
const named = z.object({ id: z.string().min(1), name: z.string() });
const customersList = z.object({ customers: z.array(named) });
const processItemsList = z.object({ processItems: z.array(named) });
const materialsList = z.object({ materials: z.array(z.object({ id: z.string().min(1), materialInDrawing: z.string() })) });
const treatmentsList = z.object({ treatments: z.array(named) });
const oneCustomer = z.object({ id: z.string().min(1), rates: z.array(z.object({ processItemId: z.string() })) });

export interface CustomerRef {
  readonly id: string;
  readonly name: string;
}

async function read<T>(admin: Session, what: string, path: string, schema: z.ZodType<T>): Promise<T> {
  const reply = await mustCall(admin, what, 'GET', path, OK);
  const parsed = schema.safeParse(jsonOf(reply));
  if (!parsed.success) throw new Error(`${what} answered in a shape the script does not know`);
  return parsed.data;
}

const startsWithVolume = (text: string): boolean => text.startsWith('Volume ');

export interface MasterData {
  readonly customers: ReadonlyArray<CustomerRef>;
  readonly firstMaterialId: string;
}

async function ensureProcessItems(admin: Session, config: LoadConfig): Promise<void> {
  const known = await read(admin, 'the Process Master list', '/api/v1/process-items', processItemsList);
  const have = known.processItems.filter((item) => startsWithVolume(item.name)).length;
  // The migration's 15 items are in the total, so only the difference is added.
  const missing = Array.from({ length: Math.max(0, config.processItemsTotal - known.processItems.length) }, (_, n) => have + n + 1);
  await mapLimit(missing, SEED_CONCURRENCY, async (n) => {
    await mustCall(admin, 'adding a Process Master item', 'POST', '/api/v1/process-items', CREATED, { json: { name: processItemName(n), unit: 'per second', defaultValue: INVENTED_RATE } });
  });
}

async function ensureCustomers(admin: Session, config: LoadConfig): Promise<ReadonlyArray<CustomerRef>> {
  const known = await read(admin, 'the customers list', '/api/v1/customers', customersList);
  const have = known.customers.filter((customer) => startsWithVolume(customer.name)).length;
  const missing = Array.from({ length: Math.max(0, config.customers - have) }, (_, n) => have + n + 1);
  const created = new Map<number, string>();
  await mapLimit(missing, SEED_CONCURRENCY, async (n) => {
    const reply = await mustCall(admin, 'adding a customer', 'POST', '/api/v1/customers', CREATED, { json: { name: customerName(n), shortName: customerShortName(n) } });
    const parsed = idOnly.safeParse(jsonOf(reply));
    if (!parsed.success) throw new Error('adding a customer answered in a shape the script does not know');
    created.set(n, parsed.data.id);
  });
  await changeSomeRates(admin, created);
  const after = await read(admin, 'the customers list', '/api/v1/customers', customersList);
  return after.customers.filter((customer) => startsWithVolume(customer.name));
}

/** Five rates changed on every fifth customer that this run made, so the list's "differs" count is not always 0 (test strategy 8.1, step 3). */
async function changeSomeRates(admin: Session, created: ReadonlyMap<number, string>): Promise<void> {
  const items = await read(admin, 'the Process Master list', '/api/v1/process-items', processItemsList);
  const rates = items.processItems.slice(0, CHANGED_RATES_PER_CUSTOMER).map((item) => ({ processItemId: item.id, value: CHANGED_RATE }));
  const chosen = [...created].filter(([n]) => n % CUSTOMER_CHANGE_EVERY === 0);
  await mapLimit(chosen, SEED_CONCURRENCY, async ([, id]) => {
    await mustCall(admin, 'changing rates of a customer', 'PATCH', `/api/v1/customers/${id}`, OK, { json: { rates } });
  });
}

async function ensureMaterials(admin: Session, config: LoadConfig): Promise<string> {
  const known = await read(admin, 'the materials list', '/api/v1/materials', materialsList);
  const have = known.materials.filter((material) => startsWithVolume(material.materialInDrawing)).length;
  const missing = Array.from({ length: Math.max(0, config.materials - have) }, (_, n) => have + n + 1);
  await mapLimit(missing, SEED_CONCURRENCY, async (n) => {
    const name = materialName(n);
    await mustCall(admin, 'adding a material', 'POST', '/api/v1/materials', CREATED, {
      json: { materialInDrawing: name, materialConsidered: name, ...INVENTED_MATERIAL },
    });
  });
  const after = await read(admin, 'the materials list', '/api/v1/materials', materialsList);
  const first = after.materials.find((material) => startsWithVolume(material.materialInDrawing));
  if (first === undefined) throw new Error('the materials list holds no invented material after they were added');
  return first.id;
}

async function ensureTreatments(admin: Session, config: LoadConfig): Promise<void> {
  const known = await read(admin, 'the Treatment / Color list', '/api/v1/treatments', treatmentsList);
  const have = known.treatments.filter((treatment) => startsWithVolume(treatment.name)).length;
  const missing = Array.from({ length: Math.max(0, config.treatments - have) }, (_, n) => have + n + 1);
  await mapLimit(missing, SEED_CONCURRENCY, async (n) => {
    await mustCall(admin, 'adding a Treatment / Color entry', 'POST', '/api/v1/treatments', CREATED, { json: { name: treatmentName(n) } });
  });
}

/** Seeds the volume the PRD plans for and returns what the next steps need. */
export async function seedMasters(admin: Session, config: LoadConfig): Promise<MasterData> {
  await mustCall(admin, 'saving the exchange rates', 'PUT', '/api/v1/exchange-rates', OK, { json: INVENTED_EXCHANGE_RATES });
  await ensureProcessItems(admin, config);
  const customers = await ensureCustomers(admin, config);
  const firstMaterialId = await ensureMaterials(admin, config);
  await ensureTreatments(admin, config);
  return { customers, firstMaterialId };
}

/**
 * The checks of test strategy 8.1 before any figure is taken: the list holds the customers, and one customer holds a rate for every Process Master item. A wrong count fails the run here, because
 * a figure measured on the wrong data says nothing.
 */
export async function verifyVolume(admin: Session, config: LoadConfig, data: MasterData): Promise<void> {
  if (data.customers.length < config.customers) throw new Error(`the customers list holds ${data.customers.length} invented customers, the run needs ${config.customers}`);
  const first = data.customers[0];
  if (first === undefined) throw new Error('there is no customer to read');
  // There is no GET route for one customer; a save that changes nothing (the same name) answers with the customer and all its rates, writes nothing and raises no audit entry.
  const reply = await mustCall(admin, 'one customer', 'PATCH', `/api/v1/customers/${first.id}`, OK, { json: { name: first.name } });
  const parsed = oneCustomer.safeParse(jsonOf(reply));
  if (!parsed.success) throw new Error('one customer answered in a shape the script does not know');
  if (parsed.data.rates.length !== config.processItemsTotal) {
    throw new Error(`one customer holds ${parsed.data.rates.length} rates, the run needs ${config.processItemsTotal} (one for every Process Master item)`);
  }
}
