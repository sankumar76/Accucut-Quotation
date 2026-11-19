import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { REPOSITORY_ROOT } from '../support/scan-files';
import { looksPersonal, parseSchemaColumns, type SchemaColumn } from '../support/schema-columns';

/**
 * STORY-10.12 AC-3 (NFR-028; architecture section on data minimisation): personal data is kept to the fields the business agreed.
 * A user has a name and an e-mail address (and nothing else about the person); a customer has a name and the contact details of
 * the business: a phone number, an e-mail address and an address. A column that holds personal data anywhere else, or of another
 * kind, fails this test, and the person adding it raises it with the architect first: it is a change of what the portal
 * promises about people's data, not a detail of one story.
 */

/** The only places that may hold personal data, by table, and the columns each may hold. The architect owns this list. */
const PERSONAL_DATA_ALLOWED: Readonly<Record<string, ReadonlyArray<string>>> = {
  users: ['name', 'email'],
  customers: ['name', 'phone', 'email', 'address'],
};

const RAISE_WITH_ARCHITECT = 'Personal data may live only in users (name, e-mail) and customers (name, phone, e-mail, address). Raise a new column with the architect before adding it.';

/** The columns of `schema` that hold personal data but are not on the allowed list, as `table.column`. */
function personalDataOutsideAllowedList(columns: ReadonlyArray<SchemaColumn>): string[] {
  return columns
    .filter((column) => looksPersonal(column.column) || looksPersonal(column.field))
    .filter((column) => !(PERSONAL_DATA_ALLOWED[column.table] ?? []).includes(column.column))
    .map((column) => `${column.table}.${column.column}`);
}

const schemaText = readFileSync(join(REPOSITORY_ROOT, 'prisma/schema.prisma'), 'utf8');
const columns = parseSchemaColumns(schemaText);

describe('AC-3: personal data lives only on users and customers', () => {
  it('reads the schema: the tables are there, mapped to their table names, and relations are not counted as columns', () => {
    const tables = new Set(columns.map((column) => column.table));
    for (const table of ['users', 'customers', 'audit_log', 'estimates', 'tasks']) expect(tables, table).toContain(table);
    expect(columns.some((column) => column.field === 'configVersions' || column.field === 'rates')).toBe(false);
    expect(columns.find((column) => column.table === 'users' && column.field === 'passwordHash')?.column).toBe('password_hash');
  });

  it('holds the allowed columns it promises: the name and e-mail of a user, the name, phone, e-mail and address of a customer', () => {
    for (const [table, allowed] of Object.entries(PERSONAL_DATA_ALLOWED)) {
      const present = columns.filter((column) => column.table === table).map((column) => column.column);
      for (const column of allowed) expect(present, `${table}.${column}`).toContain(column);
    }
  });

  it('AC-3: no column outside users and customers holds personal data, and users and customers hold nothing beyond the list', () => {
    const outside = personalDataOutsideAllowedList(columns);
    expect(outside, `${outside.join(', ')}\n${RAISE_WITH_ARCHITECT}`).toEqual([]);
  });
});

describe('AC-3: negative control, a new personal-data column is caught', () => {
  /** The real schema with one line added to the model called `model`. */
  function withColumn(model: string, line: string): SchemaColumn[] {
    const start = schemaText.indexOf(`model ${model} {`);
    const afterBrace = schemaText.indexOf('\n', start) + 1;
    return parseSchemaColumns(`${schemaText.slice(0, afterBrace)}  ${line}\n${schemaText.slice(afterBrace)}`);
  }

  it.each([
    ['Task', 'contactPhone String?', 'tasks.contactPhone'],
    ['Estimate', 'customerEmail String? @map("customer_email")', 'estimates.customer_email'],
    ['Material', 'supplierAddress String?', 'materials.supplierAddress'],
    ['User', 'dateOfBirth DateTime? @map("date_of_birth")', 'users.date_of_birth'],
    ['User', 'phone String?', 'users.phone'],
    ['Customer', 'aadhaarNumber String? @map("aadhaar_number")', 'customers.aadhaar_number'],
    ['Customer', 'gstContactMobile String?', 'customers.gstContactMobile'],
    ['Approval', 'approverPan String? @map("approver_pan")', 'approvals.approver_pan'],
    ['AuditLog', 'passportNo String? @map("passport_no")', 'audit_log.passport_no'],
    ['Task', 'firstName String? @map("first_name")', 'tasks.first_name'],
  ])('fails when %s gains `%s`, and names %s', (model, line, named) => {
    const outside = personalDataOutsideAllowedList(withColumn(model, line));
    expect(outside).toEqual([named]);
  });

  it('passes on the real schema with a harmless column added, so the control is the column and not the edit', () => {
    expect(personalDataOutsideAllowedList(withColumn('Task', 'priority Int @default(0)'))).toEqual([]);
    expect(personalDataOutsideAllowedList(withColumn('Task', 'companyCode String? @map("company_code")'))).toEqual([]);
  });

  it('says to raise it with the architect', () => {
    expect(RAISE_WITH_ARCHITECT).toContain('architect');
  });
});

describe('AC-3: what counts as personal data in a name', () => {
  it.each(['email', 'contactEmail', 'phone', 'mobile_no', 'telephone', 'homeAddress', 'address', 'dateOfBirth', 'birth_date', 'dob', 'aadhaarNo', 'aadhar', 'pan', 'panNumber', 'passport', 'ssn', 'firstName', 'last_name', 'gender'])(
    'treats %s as personal',
    (name) => {
      expect(looksPersonal(name)).toBe(true);
    },
  );

  it.each(['name', 'id', 'company', 'companyCode', 'span', 'message', 'usage', 'pricePerKg', 'actorLabel', 'objectLabel', 'passwordHash', 'folderPath', 'fileName', 'title', 'notes', 'stamp'])(
    'does not treat %s as personal',
    (name) => {
      expect(looksPersonal(name)).toBe(false);
    },
  );
});
