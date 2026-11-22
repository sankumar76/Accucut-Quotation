import { describe, expect, it } from 'vitest';

import {
  ASSIGN_FIELD_NAMES,
  checkAssign,
  CUSTOMER_MESSAGE,
  DEADLINE_MESSAGE,
  ENGINEER_MESSAGE,
  FOLDER_PATH_MESSAGE,
  FOLDER_PATH_TOO_LONG_MESSAGE,
  joinDeadline,
  NOTES_MESSAGE,
  SUBJECT_MAX_LENGTH,
  SUBJECT_MESSAGE,
  SUBJECT_ONE_LINE_MESSAGE,
  SUBJECT_REQUIRED_MESSAGE,
  TITLE_MESSAGE,
  TITLE_REQUIRED_MESSAGE,
  type AssignInput,
} from '@/lib/tasks/assign';
import { FOLDER_PATH_MAX_LENGTH, folderUrlOf, isUncPath } from '@/lib/tasks/folder-path';
import { formatTaskCode } from '@/lib/tasks/task-code';

/**
 * STORY-04.01 T2, T3, T5 (AC-1, AC-2, AC-3, AC-4, AC-6): the pure rules of "Assign task". The words are the UX spec's (SCR-04 "Form fields"), written
 * out here and not imported, so a changed sentence fails a test. Every server, share, name and path is invented.
 */

const NOW = new Date('2026-11-09T04:00:00.000Z');
const PATH = '\\\\server\\share\\RFQ-123';

const valid: AssignInput = {
  engineerId: '00000000-0000-4000-8000-0000000000e1',
  customerId: '00000000-0000-4000-8000-0000000000c1',
  folderPath: PATH,
  deadline: '2026-11-09T23:30',
  title: 'Hopper cover',
  subject: 'Feed hopper',
  notes: 'Sheet-metal parts only.',
};

describe('AC-3: the words of the messages are the UX spec’s', () => {
  it('says what to do under each field', () => {
    expect(ENGINEER_MESSAGE).toBe('Choose an Engineer.');
    expect(CUSTOMER_MESSAGE).toBe('Choose a customer.');
    expect(FOLDER_PATH_MESSAGE).toBe('Enter the network folder path. It starts with two backslashes, like \\\\server\\share\\RFQ-123.');
    expect(DEADLINE_MESSAGE).toBe('Choose a deadline later than now.');
    expect(TITLE_REQUIRED_MESSAGE).toBe('Enter a title.');
    expect(TITLE_MESSAGE).toBe('Keep the title under 120 characters.');
    expect(SUBJECT_REQUIRED_MESSAGE).toBe('Enter the subject.');
    expect(SUBJECT_MESSAGE).toBe('Keep the subject under 80 characters.');
    expect(SUBJECT_ONE_LINE_MESSAGE).toBe('Enter the subject on one line, without hidden characters.');
    expect(NOTES_MESSAGE).toBe('Keep the notes under 1,000 characters.');
  });
});

describe('AC-1: a valid input comes out trimmed, with the deadline as a UTC instant', () => {
  it('keeps the values, reads 23:30 IST as 18:00 UTC, and trims the path, the title and the notes', () => {
    const result = checkAssign({ ...valid, folderPath: `  ${PATH}  `, title: ' Hopper cover ', subject: '  Feed hopper ', customerId: ` ${valid.customerId} `, notes: ' Sheet-metal parts only.\n' }, NOW);
    expect(result).toEqual({
      ok: true,
      values: {
        engineerId: valid.engineerId,
        customerId: valid.customerId,
        folderPath: PATH,
        deadlineAt: new Date('2026-11-09T18:00:00.000Z'),
        title: 'Hopper cover',
        subject: 'Feed hopper',
        notes: 'Sheet-metal parts only.',
      },
    });
  });

  it('makes empty notes null: the notes are the only optional field (the title became required with CR-01 item 6)', () => {
    const result = checkAssign({ ...valid, notes: '' }, NOW);
    expect(result.ok && result.values.notes).toBeNull();
  });

  it('accepts a title of exactly 120 characters and notes of exactly 1,000', () => {
    expect(checkAssign({ ...valid, title: 'T'.repeat(120), notes: 'N'.repeat(1_000) }, NOW).ok).toBe(true);
  });

  it('counts a letter outside the basic plane as one character, as the database does', () => {
    expect(checkAssign({ ...valid, title: '\u{1F600}'.repeat(120) }, NOW).ok).toBe(true);
    expect(checkAssign({ ...valid, title: '\u{1F600}'.repeat(121) }, NOW)).toMatchObject({ ok: false, errors: { title: TITLE_MESSAGE } });
  });
});

describe('AC-3: every problem is named at once, under its own field', () => {
  it('names every required field of an empty form (all but the notes), and the deadline and Engineer messages are the spec’s', () => {
    const result = checkAssign({ engineerId: '', customerId: '', folderPath: '', deadline: '', title: '', subject: '', notes: '' }, NOW);
    expect(result).toEqual({
      ok: false,
      errors: {
        engineerId: ENGINEER_MESSAGE,
        customerId: CUSTOMER_MESSAGE,
        folderPath: FOLDER_PATH_MESSAGE,
        deadline: DEADLINE_MESSAGE,
        title: TITLE_REQUIRED_MESSAGE,
        subject: SUBJECT_REQUIRED_MESSAGE,
      },
    });
  });

  it('refuses a title of 121 characters and notes of 1,001', () => {
    const result = checkAssign({ ...valid, title: 'T'.repeat(121), notes: 'N'.repeat(1_001) }, NOW);
    expect(result).toEqual({ ok: false, errors: { title: TITLE_MESSAGE, notes: NOTES_MESSAGE } });
  });

  it('refuses a deadline exactly now and one a minute ago, and accepts one a minute from now (edge: a deadline exactly now)', () => {
    const now = new Date('2026-11-09T18:00:00.000Z');
    expect(checkAssign({ ...valid, deadline: '2026-11-09T23:30' }, now)).toMatchObject({ ok: false, errors: { deadline: DEADLINE_MESSAGE } });
    expect(checkAssign({ ...valid, deadline: '2026-11-09T23:29' }, now)).toMatchObject({ ok: false, errors: { deadline: DEADLINE_MESSAGE } });
    expect(checkAssign({ ...valid, deadline: '2026-11-09T23:31' }, now).ok).toBe(true);
  });

  it('judges the deadline in IST: 23:30 IST on the 9th is later than 18:01 UTC on the 9th, 00:30 IST on the 10th is later still', () => {
    expect(checkAssign({ ...valid, deadline: '2026-11-09T23:30' }, new Date('2026-11-09T17:59:00.000Z')).ok).toBe(true);
    expect(checkAssign({ ...valid, deadline: '2026-11-09T23:30' }, new Date('2026-11-09T18:01:00.000Z')).ok).toBe(false);
  });

  it.each(['2026-02-30T10:00', '2026-11-09', '2026-11-09T24:00', '2026-11-09 10:00', 'tomorrow', '2026-11-09T10:00Z'])('refuses the deadline "%s" with the deadline message', (deadline) => {
    expect(checkAssign({ ...valid, deadline }, NOW)).toMatchObject({ ok: false, errors: { deadline: DEADLINE_MESSAGE } });
  });

  it('refuses a path longer than the limit with a message of its own', () => {
    const longPath = `\\\\server\\share\\${'a'.repeat(FOLDER_PATH_MAX_LENGTH)}`;
    expect(checkAssign({ ...valid, folderPath: longPath }, NOW)).toMatchObject({ ok: false, errors: { folderPath: FOLDER_PATH_TOO_LONG_MESSAGE } });
  });
});

describe('CR-01 item 6 (AQP-390): the customer, the subject and the title are required', () => {
  it('lists the fields in the order of the form, so the summary and the first focus follow the page', () => {
    expect(ASSIGN_FIELD_NAMES).toEqual(['engineerId', 'customerId', 'folderPath', 'deadline', 'title', 'subject', 'notes']);
  });

  it('refuses a missing customer, an empty title and an empty subject, and a title or a subject of spaces only', () => {
    expect(checkAssign({ ...valid, customerId: '  ', title: '   ', subject: '\t ' }, NOW)).toEqual({
      ok: false,
      errors: { customerId: CUSTOMER_MESSAGE, title: TITLE_REQUIRED_MESSAGE, subject: SUBJECT_REQUIRED_MESSAGE },
    });
  });

  it('accepts a subject of exactly SUBJECT_MAX_LENGTH characters and refuses one more, counting a letter outside the basic plane as one', () => {
    expect(SUBJECT_MAX_LENGTH).toBe(80);
    expect(checkAssign({ ...valid, subject: 'S'.repeat(SUBJECT_MAX_LENGTH) }, NOW).ok).toBe(true);
    expect(checkAssign({ ...valid, subject: 'S'.repeat(SUBJECT_MAX_LENGTH + 1) }, NOW)).toMatchObject({ ok: false, errors: { subject: SUBJECT_MESSAGE } });
    expect(checkAssign({ ...valid, subject: '\u{1F600}'.repeat(SUBJECT_MAX_LENGTH) }, NOW).ok).toBe(true);
    expect(checkAssign({ ...valid, subject: '\u{1F600}'.repeat(SUBJECT_MAX_LENGTH + 1) }, NOW)).toMatchObject({ ok: false, errors: { subject: SUBJECT_MESSAGE } });
  });

  it('measures the subject after trimming: 80 characters inside spaces are accepted', () => {
    expect(checkAssign({ ...valid, subject: `  ${'S'.repeat(SUBJECT_MAX_LENGTH)}  ` }, NOW).ok).toBe(true);
  });

  it('keeps a subject with the characters that cannot be in a file name as typed (the file-name builder cleans them, CR01-9)', () => {
    const result = checkAssign({ ...valid, subject: 'A/B \\ C:D *?"<>|' }, NOW);
    expect(result.ok && result.values.subject).toBe('A/B \\ C:D *?"<>|');
  });

  it('keeps Unicode in the subject', () => {
    const result = checkAssign({ ...valid, subject: 'Feed hopper, \u0905\u0928\u0941' }, NOW);
    expect(result.ok && result.values.subject).toBe('Feed hopper, \u0905\u0928\u0941');
  });

  it.each(['Line one\nline two', 'Tab\tseparated', 'Carriage\rreturn', 'Null\u0000byte', 'Hopper\u200b', 'Fe\u200ded', 'Bidi\u202eover'])('refuses a subject that is not one line of visible text (%j)', (subject) => {
    expect(checkAssign({ ...valid, subject }, NOW)).toMatchObject({ ok: false, errors: { subject: SUBJECT_ONE_LINE_MESSAGE } });
  });

  it.each(['\u200b', '\u200b\u200b', '\u2060'])('says "required" for a subject with nothing visible (%j)', (subject) => {
    expect(checkAssign({ ...valid, subject }, NOW)).toMatchObject({ ok: false, errors: { subject: SUBJECT_REQUIRED_MESSAGE } });
  });

  it('puts none of the typed value in a message', () => {
    const typed = 'Secret-looking subject '.repeat(10);
    const result = checkAssign({ ...valid, subject: typed, title: typed }, NOW);
    expect(JSON.stringify(result)).not.toContain('Secret-looking');
  });
});

describe('joinDeadline writes the two fields as one text, and nothing when either is missing', () => {
  it('joins a date and a time', () => {
    expect(joinDeadline('2026-11-09', '10:00')).toBe('2026-11-09T10:00');
  });

  it.each([
    ['', '10:00'],
    ['2026-11-09', ''],
    ['', ''],
  ])('gives "" for the date "%s" and the time "%s"', (date, time) => {
    expect(joinDeadline(date, time)).toBe('');
  });
});

describe('AC-3, AC-4: what counts as a UNC path', () => {
  it.each([
    PATH,
    '\\\\server\\share',
    '\\\\server\\share\\',
    '\\\\file-server.example.test\\rfq\\2026\\RFQ 123 (new)\\',
    '\\\\server\\share\\Zeichnung für Gehäuse',
    '\\\\192.0.2.10\\drawings$\\RFQ-9',
  ])('accepts %s', (path) => {
    expect(isUncPath(path)).toBe(true);
  });

  it.each([
    '',
    'server\\share',
    '\\server\\share',
    '\\\\server',
    '\\\\server\\',
    '\\\\\\share\\folder',
    '\\\\server\\\\folder',
    '\\\\server\\share\\\\folder',
    '//server/share/folder',
    'C:\\Users\\invented',
    'javascript:alert(1)',
    'file:////server/share',
    '\\\\server\\share\\a:b',
    '\\\\server\\share\\a/b',
    '\\\\server\\share\\a|b',
    '\\\\server\\share\\a?b*',
    '\\\\server\\share\\<script>',
    '\\\\server\\share\\line\nbreak',
    '\\\\server\\share\\tab\there',
    '\\\\server\\ \\folder',
  ])('refuses "%s"', (path) => {
    expect(isUncPath(path)).toBe(false);
  });

  it('refuses a path over the limit and accepts one at the limit', () => {
    const prefix = '\\\\server\\share\\';
    expect(isUncPath(prefix + 'a'.repeat(FOLDER_PATH_MAX_LENGTH - prefix.length))).toBe(true);
    expect(isUncPath(prefix + 'a'.repeat(FOLDER_PATH_MAX_LENGTH - prefix.length + 1))).toBe(false);
  });
});

describe('AC-4: the file link is built from a valid UNC path only', () => {
  it('builds file:/// from the server, share and folders', () => {
    expect(folderUrlOf(PATH)).toBe('file:////server/share/RFQ-123');
    expect(folderUrlOf(PATH)?.startsWith('file:///')).toBe(true);
  });

  it('encodes a space, a bracket and a letter outside ASCII in each part, and drops a trailing backslash', () => {
    expect(folderUrlOf('\\\\server\\share\\RFQ 123 [new]\\Gehäuse\\')).toBe('file:////server/share/RFQ%20123%20%5Bnew%5D/Geh%C3%A4use');
  });

  it('keeps a percent sign and a hash from changing the address: they are encoded', () => {
    expect(folderUrlOf('\\\\server\\share\\100%#1')).toBe('file:////server/share/100%25%231');
  });

  it.each(['javascript:alert(1)', 'data:text/html,<b>x</b>', 'https://invented.example.test/x', '\\\\server', ''])('makes no link from "%s": a scheme other than file: is impossible', (text) => {
    expect(folderUrlOf(text)).toBeNull();
  });
});

describe('AC-2: the code of a task', () => {
  it('is Q, the year and the running number with at least four digits', () => {
    expect(formatTaskCode(2026, 324)).toBe('Q-2026-0324');
    expect(formatTaskCode(2027, 1)).toBe('Q-2027-0001');
    expect(formatTaskCode(2026, 9_999)).toBe('Q-2026-9999');
  });

  it('grows past four digits instead of cutting the number', () => {
    expect(formatTaskCode(2026, 10_000)).toBe('Q-2026-10000');
  });
});
