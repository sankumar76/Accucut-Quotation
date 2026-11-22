import type { Client } from 'pg';

/**
 * A customer for the integration tests that assign tasks (CR-01 item 6, AQP-390): a task is assigned for a customer that is not deleted, so each such test makes one with the owner's connection and uses its
 * ID in the assignment. The short name is made from the name, as in the other raw customer inserts (`left(md5(name), 10)`). The name is invented.
 */
export async function insertAssignCustomer(owner: Pick<Client, 'query'>, name: string): Promise<string> {
  const { rows } = await owner.query<{ id: string }>('INSERT INTO customers (name, short_name) VALUES ($1, left(md5($1), 10)) RETURNING id::text AS id', [name]);
  const id = rows[0]?.id;
  if (id === undefined) throw new Error('The customer was not inserted.');
  return id;
}
