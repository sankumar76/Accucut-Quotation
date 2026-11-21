import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { PLACEHOLDER_PHONE_PATTERN } from '../support/placeholder-pattern';
import {
  describeFindings,
  findUninventedPhones,
  findUnreservedEmails,
  isExcepted,
  isReservedDomain,
  scanForPersonalData,
  type PersonalDataFinding,
  type PrivacyException,
} from '../support/privacy-scan';
import { REPOSITORY_ROOT, textFilesIn, trackedFiles } from '../support/scan-files';

/**
 * STORY-10.12 AC-1, AC-2, AC-7 (NFR-028, NFR-006, RISK-006; test strategy section 9): every e-mail address and phone number in the
 * test fixtures, the seed placeholders, the environment template and the documents is an invented one, so a public repository
 * never holds a real person's details. The scan is `tests/support/privacy-scan.ts`; this file holds the scope, the one list of
 * reviewed exceptions, and the negative control that proves the scan can find what it is looking for.
 *
 * No real-looking value is written out in the repository, not even in the control: the control builds its planted values from
 * parts at run time, in a temporary folder, so neither this scan nor the secret scan (Gitleaks, CI stage 2) can read them.
 */

/** What is scanned: folders end in a slash, anything else is one file. The environment template is read by this test, never by a person. */
const SCAN_SCOPE: ReadonlyArray<string> = ['tests/', 'prisma/seed/', 'docs/', '.env.example'];

/**
 * The one reviewed list of matches that are not personal data. Each entry says what it is and why it is safe. Add to it only
 * with a reason a reviewer can check; an entry the scan no longer meets fails below, so the list cannot grow stale.
 */
const PRIVACY_EXCEPTIONS: ReadonlyArray<PrivacyException> = [
  // The words of the form field and its test. The domain is a real one but the text is not an address anyone uses: it is the
  // grey hint in the e-mail box (ux-spec) and the tests that pin the hint and the validation messages around it.
  { kind: 'email', value: 'name@company.com', reason: 'Placeholder hint text of the e-mail field (UX spec SCR-01, SCR-12) and the tests and screens that show it; not a mailbox.' },
  // Inputs of the e-mail format check in customers-lib and its route tests: they test the shape of an address, not a person.
  { kind: 'email', value: 'me@company.com', reason: 'Input of the e-mail format check (customers-lib tests): shows a well-formed address is accepted; not a mailbox.' },
  { kind: 'email', value: 'a.b+c@sub.company.co.in', reason: 'Input of the e-mail format check (customers-lib tests): a plus sign and a sub-domain are accepted; not a mailbox.' },
  { kind: 'email', value: 'a@b.co', reason: 'Input of the e-mail format check (customers-lib tests): the shortest well-formed address; not a mailbox.' },
  // The UX sample screens (docs/03-ux) show invented customer phones in a 5-digit tail form that is not the +99 555 01nn
  // pattern. They are sequential dummies (00001 to 00005), not people's numbers. The UX owner can move them to the pattern;
  // until then they are listed here, one by one, so no other number of that shape gets in.
  { kind: 'phone', value: '+91 98765 0000', reason: 'UX generator README: the sample-phone format in the instructions, a dummy sequence; not a person.' },
  { kind: 'phone', value: '+91 98765 00001', reason: 'UX sample screen SCR-12 and its generator: sequential dummy customer phone; not a person.' },
  { kind: 'phone', value: '+91 98765 00002', reason: 'UX sample screen SCR-12 and its generator: sequential dummy customer phone; not a person.' },
  { kind: 'phone', value: '+91 98765 00003', reason: 'UX sample screen SCR-12 and its generator: sequential dummy customer phone; not a person.' },
  { kind: 'phone', value: '+91 98765 00004', reason: 'UX sample screen SCR-12 and its generator: sequential dummy customer phone; not a person.' },
  { kind: 'phone', value: '+91 98765 00005', reason: 'UX sample screen SCR-12 and its generator: sequential dummy customer phone; not a person.' },
];

const PLANT = {
  /** `invented.person` at a mainstream mail provider: the shape of a real address, put together at run time. */
  email: ['invented.person', '@', 'gmail', '.', 'com'].join(''),
  /** The shape of an Indian mobile number with its country code, put together at run time. */
  phone: ['+91', '98765', '43210'].join(' '),
} as const;

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

/** A folder in the system temporary folder that holds `files` (path to text), removed after the test. */
function temporaryFixture(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(join(tmpdir(), 'aqp-privacy-'));
  temporaryDirectories.push(root);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

describe('AC-1: the repository holds only invented e-mail addresses and phone numbers', () => {
  let scanned: string[] = [];
  let found: PersonalDataFinding[] = [];

  beforeAll(() => {
    scanned = textFilesIn(trackedFiles(), SCAN_SCOPE);
    found = scanForPersonalData(REPOSITORY_ROOT, scanned);
  });

  it('the scan reads the folders it is meant to read, so a pass is not an empty scan', () => {
    expect(scanned).toContain('.env.example');
    for (const folder of ['tests/unit/', 'tests/support/', 'prisma/seed/', 'docs/']) {
      expect(
        scanned.some((path) => path.startsWith(folder)),
        `${folder} is scanned`,
      ).toBe(true);
    }
    expect(scanned.length).toBeGreaterThan(300);
  });

  it('AC-1: every e-mail address is on a reserved domain and every phone number is the invented form, or is on the reviewed list', () => {
    const unexplained = found.filter((finding) => !isExcepted(finding, PRIVACY_EXCEPTIONS));
    expect(unexplained, `Not an invented value (use example.test and +99 555 01nn):\n${describeFindings(unexplained)}`).toEqual([]);
  });

  it('every reviewed exception has a reason, is for one match only, and still matches something in the repository', () => {
    for (const exception of PRIVACY_EXCEPTIONS) {
      expect(exception.reason.trim().length, `${exception.value} needs a reason`).toBeGreaterThan(10);
      expect(
        found.some((finding) => isExcepted(finding, [exception])),
        `${exception.kind} ${exception.value} is on the reviewed list but no longer found: remove it`,
      ).toBe(true);
    }
    const keys = PRIVACY_EXCEPTIONS.map((exception) => `${exception.kind}:${exception.value.toLowerCase()}`);
    expect(new Set(keys).size, 'an exception is listed twice').toBe(keys.length);
  });
});

describe('AC-1: what counts as an invented value', () => {
  it.each(['example.com', 'example.org', 'example.net', 'mail.example.com', 'a.b.example.net', 'qa.example.test', 'example.test', 'host.invalid', 'brand.example', 'UPPER.EXAMPLE.ORG'])(
    'accepts the reserved domain %s',
    (domain) => {
      expect(isReservedDomain(domain)).toBe(true);
      expect(findUnreservedEmails(`person@${domain}`)).toEqual([]);
    },
  );

  it.each([
    ['gmail', '.com'],
    ['example', '.com.au'],
    ['notexample', '.com'],
    ['example', '.co'],
    ['company', '.com'],
    ['mail', '.test.dev'],
  ])('refuses a domain that only looks reserved or is real: %s%s', (name, ending) => {
    const address = `person@${name}${ending}`;
    expect(findUnreservedEmails(`write to ${address} today`)).toEqual([address]);
  });

  it('is not fooled by text that has an at sign but is not an address: a package version, a scope, a handle without a domain', () => {
    for (const text of ['npm install eslint@9.39.5', 'import "@types/node"', 'the @mention and @alsoThis', 'git+ssh://host/repo@v1.2.3-beta.1', 'user@localhost']) {
      expect(findUnreservedEmails(text), text).toEqual([]);
    }
  });

  it('accepts the invented phone form, +99 555 01nn, and nothing near it', () => {
    expect(PLACEHOLDER_PHONE_PATTERN.test('+99 555 0142')).toBe(true);
    expect(PLACEHOLDER_PHONE_PATTERN.test('+99 555 0100')).toBe(true);
    expect(findUninventedPhones('Phone: +99 555 0173.')).toEqual([]);
    // Built from parts, so that this file holds no number that the scan above would itself have to judge.
    const nearMisses = [
      ['+99', '555', '0242'].join(' '),
      ['+98', '555', '0142'].join(' '),
      ['+99', '555', '142'].join(' '),
      ['+99', '555', '01420'].join(' '),
      ['+99', '555', '0142'].join('-'),
    ];
    for (const near of nearMisses) expect(PLACEHOLDER_PHONE_PATTERN.test(near), near).toBe(false);
  });

  it.each([
    ['an international number', ['+91', '98765', '43210'].join(' ')],
    ['an international number with hyphens', ['+44', '20', '7946', '0958'].join('-')],
    ['a solid ten-digit mobile number', ['98765', '43210'].join('')],
    ['a ten-digit mobile number in two groups', ['98765', '43210'].join(' ')],
    ['a landline in three groups', ['022', '2345', '6789'].join(' ')],
    ['a number with a bracketed area code', ['(555)', '123', '4567'].join(' ')],
  ])('finds %s', (_name, number) => {
    expect(findUninventedPhones(`call ${number} after nine`)).toEqual([number]);
  });

  it('counts ten bare digits as a phone number only on a line that is about a phone', () => {
    const bare = ['67857', '13900'].join('');
    expect(findUninventedPhones(`run ${bare} finished`)).toEqual([]);
    expect(findUninventedPhones(`Mobile: ${bare}`)).toEqual([bare]);
    expect(findUninventedPhones(`contact: ${['67857', '13900'].join(' ')}`)).toEqual([['67857', '13900'].join(' ')]);
  });

  it('does not take other numbers for phone numbers: a date, a time range, a version, an ID, a rate, a timestamp in a file name', () => {
    for (const text of [
      'on 2026-11-18 at 10:00-12:00',
      'version 22.12.0 and 1.2.3',
      'rate 12.37 and 4,500.00',
      'migration 20261103080000_config_versions',
      'id 00000000-0000-4000-8000-abcdef000001',
      'width 1920 and height 1080',
      'sum 1 000 000',
      'a ten digit counter 1234567890',
      'colour #123456 and 0x9876543210',
    ]) {
      expect(findUninventedPhones(text), text).toEqual([]);
    }
  });
});

describe('AC-2: negative control, the scan finds a planted real-looking e-mail address and phone number', () => {
  const INVENTED_EMAIL = 'quotes@invented.example.test';
  const INVENTED_PHONE = '+99 555 0142';

  it('fails on a temporary fixture that holds a real-looking address and number, and names the file, the line and what it found', () => {
    const root = temporaryFixture({
      'tests/fixtures/planted.ts': ['export const customer = {', `  email: '${INVENTED_EMAIL}',`, `  contact: '${PLANT.email}',`, `  phone: '${PLANT.phone}',`, '};', ''].join('\n'),
    });
    const findings = scanForPersonalData(root, ['tests/fixtures/planted.ts']);
    expect(findings).toEqual([
      { file: 'tests/fixtures/planted.ts', line: 3, kind: 'email', value: PLANT.email },
      { file: 'tests/fixtures/planted.ts', line: 4, kind: 'phone', value: PLANT.phone },
    ]);
    expect(findings.filter((finding) => !isExcepted(finding, PRIVACY_EXCEPTIONS))).toHaveLength(2);
    expect(describeFindings(findings)).toBe(`tests/fixtures/planted.ts:3: email: ${PLANT.email}\ntests/fixtures/planted.ts:4: phone: ${PLANT.phone}`);
  });

  it('passes on the same fixture without the plant: an invented address and an invented number are not findings', () => {
    const root = temporaryFixture({
      'tests/fixtures/clean.ts': ['export const customer = {', `  email: '${INVENTED_EMAIL}',`, `  phone: '${INVENTED_PHONE}',`, '};', ''].join('\n'),
    });
    expect(scanForPersonalData(root, ['tests/fixtures/clean.ts'])).toEqual([]);
  });

  it('finds the plant in any scanned kind of file, and reads a CRLF file with the line numbers an editor shows', () => {
    const root = temporaryFixture({
      '.env.example': `A=1\r\nMAIL_FROM=${PLANT.email}\r\n`,
      'docs/data/sample.html': `<p>\n<b>${PLANT.phone}</b>\n</p>\n`,
    });
    const findings = scanForPersonalData(root, ['.env.example', 'docs/data/sample.html']);
    expect(findings.map(({ file, line, kind }) => `${file}:${line}:${kind}`)).toEqual(['.env.example:2:email', 'docs/data/sample.html:2:phone']);
  });

  it('a reviewed exception silences only its own match, and only by kind and exact value', () => {
    const root = temporaryFixture({ 'tests/fixtures/planted.ts': `${PLANT.email}\n${PLANT.phone}\n` });
    const findings = scanForPersonalData(root, ['tests/fixtures/planted.ts']);
    const exceptions: ReadonlyArray<PrivacyException> = [{ kind: 'email', value: PLANT.email.toUpperCase(), reason: 'a control for the exception list itself' }];
    expect(findings.filter((finding) => !isExcepted(finding, exceptions)).map((finding) => finding.kind)).toEqual(['phone']);
    expect(isExcepted({ file: 'x', line: 1, kind: 'phone', value: PLANT.email }, exceptions)).toBe(false);
  });

  it('plants nothing in the repository: the control values are not written out in this file', () => {
    const source = readFileSync(join(REPOSITORY_ROOT, 'tests/unit/privacy-fixtures.test.ts'), 'utf8');
    expect(source).not.toContain(PLANT.email);
    expect(source).not.toContain(PLANT.phone);
  });
});

describe('AC-7: the checks are part of the unit set and are not nightly', () => {
  const NEW_TESTS = ['privacy-fixtures', 'privacy-schema', 'english-only', 'no-personal-data-delete'].map((name) => `tests/unit/${name}.test.ts`);

  it('the four test files exist under tests/unit, which the CI unit stage runs with `vitest run tests/unit`', () => {
    const workflow = readFileSync(join(REPOSITORY_ROOT, '.github/workflows/ci.yml'), 'utf8');
    expect(workflow).toContain('npx vitest run tests/unit --coverage');
    for (const file of NEW_TESTS) expect(existsSync(join(REPOSITORY_ROOT, file)), file).toBe(true);
  });

  it('none of them is named by the nightly workflow', () => {
    const nightly = readFileSync(join(REPOSITORY_ROOT, '.github/workflows/nightly.yml'), 'utf8');
    for (const file of NEW_TESTS) expect(nightly).not.toContain(file.replace('tests/unit/', ''));
  });
});
