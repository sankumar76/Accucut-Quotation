import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { EXPORT_FILE_NAME_STEM_MAX_LENGTH, exportFileName, isExportFileName } from '@/lib/export/file-name';
import { CUSTOMER_SHORT_NAME_MAX_LENGTH,SHORT_NAME_TOO_LONG_MESSAGE, shortNameProblem } from '@/lib/masters/customers';
import { checkAssign, SUBJECT_MAX_LENGTH, SUBJECT_MESSAGE } from '@/lib/tasks/assign';

import { SHORT_NAME_HINT } from '@/components/features/masters/customer-texts';
import { SUBJECT_HINT } from '@/components/features/tasks/assign-texts';

/**
 * CR-01 item 6 (AQP-390, AC-16; architecture section 4.11 a): the subject limit and the short-name limit are each **one named exported constant**, used by the form's check, the server's schema, the message
 * and the hint, so changing the number changes all of them and nothing else repeats it. They are proposals (A-CR01-4) and must stay cheap to change. The database ceilings (20 and 200) are the migrations'
 * and are tested there (`tests/integration/masters/customer-short-name-migration.test.ts`, `tests/integration/tasks/task-subject-migration.test.ts`).
 *
 * Two kinds of test: the behaviour follows the constant (the edge is the constant, and the words say it), and a scan of the source finds no second copy of the number next to the words that
 * name the field. The scan has a control that plants a copy in a text and sees it found.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = (path: string): string => readFileSync(`${ROOT}${path}`, 'utf8');

describe('the limits are constants that the checks, the messages and the hints follow', () => {
  it('SUBJECT_MAX_LENGTH is the edge of the check, and its number is in the message and the hint', () => {
    const input = { engineerId: 'e', customerId: 'c', folderPath: '\\\\s\\x', deadline: '2099-01-01T10:00', title: 'T', notes: '' };
    expect(checkAssign({ ...input, subject: 'S'.repeat(SUBJECT_MAX_LENGTH) }, new Date('2026-01-01T00:00:00Z')).ok).toBe(true);
    expect(checkAssign({ ...input, subject: 'S'.repeat(SUBJECT_MAX_LENGTH + 1) }, new Date('2026-01-01T00:00:00Z'))).toMatchObject({ ok: false, errors: { subject: SUBJECT_MESSAGE } });
    expect(SUBJECT_MESSAGE).toContain(String(SUBJECT_MAX_LENGTH));
    expect(SUBJECT_HINT).toContain(String(SUBJECT_MAX_LENGTH));
  });

  it('CUSTOMER_SHORT_NAME_MAX_LENGTH is the edge of the check, and its number is in the message and the hint', () => {
    expect(shortNameProblem('S'.repeat(CUSTOMER_SHORT_NAME_MAX_LENGTH))).toBeNull();
    expect(shortNameProblem('S'.repeat(CUSTOMER_SHORT_NAME_MAX_LENGTH + 1))).toBe(SHORT_NAME_TOO_LONG_MESSAGE);
    expect(SHORT_NAME_TOO_LONG_MESSAGE).toContain(String(CUSTOMER_SHORT_NAME_MAX_LENGTH));
    expect(SHORT_NAME_HINT).toContain(String(CUSTOMER_SHORT_NAME_MAX_LENGTH));
  });
});

/** A line that names the field and holds a number the limit would be: not the definition of the constant itself, not a comment. */
function copiesOf(text: string, field: RegExp, limit: number, definition: RegExp): string[] {
  return text
    .split(/\r?\n/)
    .filter((line) => field.test(line) && !definition.test(line) && !/^\s*(\/\/|\*|\/\*)/.test(line))
    .filter((line) => new RegExp(`(?<![\\w.])${String(limit)}(?![\\w.])`).test(line.replace(/\/\*.*?\*\//g, '').replace(/\/\/.*$/, '')));
}

describe('no second copy of the number sits next to the words of the field', () => {
  const SUBJECT_FILES = [
    'src/lib/tasks/assign.ts',
    'src/server/views/schemas/tasks.ts',
    'src/components/features/tasks/assign-texts.ts',
    'src/components/features/tasks/assign-fields.tsx',
    'src/components/features/tasks/assign-form-model.ts',
    'src/server/services/task-service.ts',
  ];
  const SHORT_NAME_FILES = [
    'src/lib/masters/customers.ts',
    'src/lib/masters/customer-form.ts',
    'src/server/views/schemas/customers.ts',
    'src/server/services/customer-service.ts',
    'src/components/features/masters/customer-texts.ts',
    'src/components/features/masters/customer-details-fields.tsx',
  ];

  it.each(SUBJECT_FILES)('%s repeats no 80 beside "subject"', (path) => {
    expect(copiesOf(read(path), /subject/i, 80, /export const SUBJECT_MAX_LENGTH/)).toEqual([]);
  });

  it.each(SHORT_NAME_FILES)('%s repeats no 10 beside "short name"', (path) => {
    expect(copiesOf(read(path), /short[ _-]?name/i, 10, /export const CUSTOMER_SHORT_NAME_MAX_LENGTH/)).toEqual([]);
  });

  it('control: a copy planted in a text is found', () => {
    expect(copiesOf('const SUBJECT_TOO_LONG = "Keep the subject under 80 characters.";', /subject/i, 80, /export const SUBJECT_MAX_LENGTH/)).toHaveLength(1);
    expect(copiesOf('export const SUBJECT_MAX_LENGTH = 80;', /subject/i, 80, /export const SUBJECT_MAX_LENGTH/)).toEqual([]);
    expect(copiesOf('const message = "Keep the short name under 10 characters.";', /short[ _-]?name/i, 10, /export const CUSTOMER_SHORT_NAME_MAX_LENGTH/)).toHaveLength(1);
  });

  it('each constant is defined once, in the file the architecture names', () => {
    expect(read('src/lib/tasks/assign.ts')).toMatch(/export const SUBJECT_MAX_LENGTH = 80;/);
    expect(read('src/lib/masters/customers.ts')).toMatch(/export const CUSTOMER_SHORT_NAME_MAX_LENGTH = 10;/);
  });
});

/**
 * AQP-391 (CR-01 item 9, AC-10; NFR-032): the longest stem of the Excel file name is `EXPORT_FILE_NAME_STEM_MAX_LENGTH`, one exported constant. The check and the builder follow it (the edge is the
 * constant), and no other file of the name's path repeats the number next to the words "stem" or "file name".
 */
describe('EXPORT_FILE_NAME_STEM_MAX_LENGTH is the one place the length of the file name is set', () => {
  const NAME_FILES = ['src/lib/export/file-name.ts', 'src/server/http/content-disposition.ts', 'src/server/views/schemas/export.ts', 'src/lib/export/download-client.ts', 'src/server/http/file-response.ts'];

  it('is the edge of isExportFileName and of the stem the builder makes', () => {
    expect(isExportFileName(`${'a'.repeat(EXPORT_FILE_NAME_STEM_MAX_LENGTH)}.xlsx`)).toBe(true);
    expect(isExportFileName(`${'a'.repeat(EXPORT_FILE_NAME_STEM_MAX_LENGTH + 1)}.xlsx`)).toBe(false);
    const name = exportFileName({ customerShortName: 'MAS', subject: 'x'.repeat(EXPORT_FILE_NAME_STEM_MAX_LENGTH * 2), taskCode: 'Q-2026-0001', now: new Date('2026-11-21T12:00:00Z') });
    expect(Array.from(name.slice(0, -'.xlsx'.length))).toHaveLength(EXPORT_FILE_NAME_STEM_MAX_LENGTH);
  });

  it.each(NAME_FILES)('%s repeats no 100 beside "stem" or "file name"', (path) => {
    expect(copiesOf(read(path), /stem|file[ _-]?name/i, 100, /export const EXPORT_FILE_NAME_STEM_MAX_LENGTH/)).toEqual([]);
  });

  it('is defined once, in the builder', () => {
    expect(read('src/lib/export/file-name.ts')).toMatch(/export const EXPORT_FILE_NAME_STEM_MAX_LENGTH = 100;/);
  });
});
