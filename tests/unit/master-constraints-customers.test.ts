import { describe, expect, it } from 'vitest';

import { enforcingConstraints, MasterConstraintError } from '@/server/repositories/master-constraints';

/**
 * STORY-02.02 T1 (AC-1), the trap of architecture section 10 "Master-data storage": `constraintOf` lists the bare column `name` under the Process rule,
 * and a customers unique violation can name the column `name` too. So the customers' own index names are matched first: a violation that names `name`
 * **and** a customers index is a customer's, and one that names `name` alone stays the Process rule's. PostgreSQL through Prisma's driver adapter reports a
 * customers violation by its index name (`tests/integration/masters/customers.test.ts` shows it against the real database), so a customer never reaches the
 * bare name. The errors here are the shape the adapter gives (`meta.driverAdapterError.cause.constraint`).
 */

function uniqueViolation(names: { readonly fields?: string[]; readonly index?: string }) {
  return {
    code: 'P2002',
    meta: { driverAdapterError: { cause: { originalCode: '23505', kind: 'UniqueConstraintViolation', constraint: names } } },
  };
}

async function constraintOf(error: unknown): Promise<unknown> {
  return enforcingConstraints(() => Promise.reject(error)).catch((thrown: unknown) => (thrown instanceof MasterConstraintError ? thrown.constraint : thrown));
}

describe('which rule of the database a unique violation broke', () => {
  it.each([['uq_customers_name'], ['uq_customers_name_lower']])('maps the customers index %s to customer-name', async (index) => {
    expect(await constraintOf(uniqueViolation({ index }))).toBe('customer-name');
  });

  it('maps a violation that names the column `name` and a customers index to customer-name, not to the Process rule', async () => {
    expect(await constraintOf(uniqueViolation({ fields: ['name', 'uq_customers_name_lower'] }))).toBe('customer-name');
    expect(await constraintOf(uniqueViolation({ fields: ['uq_customers_name', 'name'] }))).toBe('customer-name');
  });

  it('keeps the bare column `name` and the Process indexes with the Process rule, and the material indexes with the material rule', async () => {
    expect(await constraintOf(uniqueViolation({ fields: ['name'] }))).toBe('process-item-name');
    expect(await constraintOf(uniqueViolation({ index: 'uq_process_items_name_lower' }))).toBe('process-item-name');
    expect(await constraintOf(uniqueViolation({ index: 'uq_materials_material_in_drawing_lower' }))).toBe('material-name');
  });

  it('passes on a violation of another index (the one on a customer and a rate) and any other failure untouched', async () => {
    const other = uniqueViolation({ index: 'uq_customer_rates_customer_id_process_item_id' });
    expect(await constraintOf(other)).toBe(other);
    const plain = new Error('connection lost');
    expect(await constraintOf(plain)).toBe(plain);
  });
});
