/**
 * Reads the columns of the models in `prisma/schema.prisma` as text, for the privacy test of the schema (STORY-10.12 AC-3). No
 * Prisma package is used: the schema is a plain file and the test needs only the model, its table, and each stored field with its
 * column name. A field whose type is another model is a relation, not a column, and is left out.
 */

export interface SchemaColumn {
  readonly model: string;
  /** The table name: the `@@map` of the model, else the model name. */
  readonly table: string;
  readonly field: string;
  /** The column name: the `@map` of the field, else the field name. */
  readonly column: string;
}

const MODEL_START = /^model\s+(\w+)\s*\{/;
const TABLE_MAP = /^@@map\("([^"]+)"\)/;
const FIELD = /^(\w+)\s+(\w+)(\[\])?(\?)?(?:\s+(.*))?$/;
const COLUMN_MAP = /@map\("([^"]+)"\)/;

interface RawField {
  readonly field: string;
  readonly type: string;
  readonly column: string;
}

interface RawModel {
  readonly name: string;
  table: string;
  readonly fields: RawField[];
}

export function parseSchemaColumns(schemaText: string): SchemaColumn[] {
  const models: RawModel[] = [];
  let current: RawModel | undefined;
  for (const raw of schemaText.split(/\r\n|\r|\n/)) {
    const line = raw.replace(/\/\/.*$/, '').trim();
    if (line === '') continue;
    const start = MODEL_START.exec(line);
    if (start !== null) {
      const name = start[1] ?? '';
      current = { name, table: name, fields: [] };
      models.push(current);
      continue;
    }
    if (current === undefined) continue;
    if (line === '}') {
      current = undefined;
      continue;
    }
    const tableMap = TABLE_MAP.exec(line);
    if (tableMap !== null) {
      current.table = tableMap[1] ?? current.table;
      continue;
    }
    if (line.startsWith('@@')) continue;
    const field = FIELD.exec(line);
    if (field === null) continue;
    const name = field[1] ?? '';
    current.fields.push({ field: name, type: field[2] ?? '', column: COLUMN_MAP.exec(field[5] ?? '')?.[1] ?? name });
  }
  const modelNames = new Set(models.map((model) => model.name));
  return models.flatMap((model) =>
    model.fields.filter((field) => !modelNames.has(field.type)).map((field) => ({ model: model.name, table: model.table, field: field.field, column: field.column })),
  );
}

/** Words in a name, from camelCase, snake_case or kebab-case, in lower case. */
function wordsOf(name: string): string[] {
  return name
    .replaceAll(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter((word) => word !== '')
    .map((word) => word.toLowerCase());
}

/** Parts of a name that mean personal data wherever they sit in it: `contactEmail`, `homeAddress`, `dateOfBirth`, `mobileNo`. */
const PERSONAL_PARTS: ReadonlyArray<string> = ['email', 'phone', 'mobile', 'telephone', 'address', 'birth', 'aadhaar', 'aadhar', 'passport', 'ssn', 'surname'];

/** Whole words that mean personal data. Short, so they are matched as words and not as parts (`pan` is in `company`, `age` in `message`). */
const PERSONAL_WORDS: ReadonlySet<string> = new Set(['pan', 'dob', 'tel', 'fax', 'age', 'gender', 'sex', 'nationality', 'pincode', 'postcode', 'zip', 'street', 'uidai']);

/** A person's name in parts: `firstName`, `last_name`. A bare `name` is not matched, for a process item or a treatment has one too. */
const PERSON_NAME_PART = /^(first|last|middle|full|given|family|nick)$/;

/** True when the name of a field or a column says it holds personal data (names matching e-mail, phone, address, birth, aadhaar, pan, passport and similar). */
export function looksPersonal(name: string): boolean {
  const words = wordsOf(name);
  const joined = words.join('');
  if (PERSONAL_PARTS.some((part) => joined.includes(part))) return true;
  if (words.some((word) => PERSONAL_WORDS.has(word))) return true;
  return words.some((word, index) => PERSON_NAME_PART.test(word) && words[index + 1] === 'name');
}
