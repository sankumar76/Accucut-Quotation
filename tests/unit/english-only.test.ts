import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { readLines, REPOSITORY_ROOT, textFilesIn, trackedFiles } from '../support/scan-files';

/**
 * STORY-10.12 AC-5 (NFR-029, inspection row of test strategy section 9): the portal is English only. This is the inspection as a
 * test: the page declares `en-IN`; no internationalisation or locale library is installed; no route has a locale segment; no
 * language switcher exists; and no source string holds a character from a non-Latin script. A second language is a decision for
 * the delivery lead (a new NFR), not something a story slips in, so this test fails until the requirement is changed first.
 */

const SOURCE_SCOPE: ReadonlyArray<string> = ['src/'];

/** The value `<html lang>` must have. */
const PAGE_LANGUAGE = 'en-IN';

/** Libraries that translate text or choose a locale. Matched against the names in package.json. */
const LOCALE_LIBRARY_NAME = /i18n|intl|lingui|formatjs|l10n|gettext|translat|polyglot|rosetta|locale/i;

/** The names a route folder takes when it is a locale: the dynamic forms, and the codes of the languages an Indian business might add. */
const LOCALE_SEGMENT =
  /^(\[+(\.\.\.)?(locale|lang|lng|language)\]+|\((locale|lang|lng|language)\)|(en|hi|ta|te|kn|ml|mr|gu|bn|pa|or|as|ur|fr|de|es|pt|it|ru|ja|ko|zh|ar)(-[a-z]{2})?)$/i;

/** What a language switcher or a translation layer is called, in a file name or in code. */
const SWITCHER_OR_TRANSLATION =
  /(language|locale|lang)[-_ ]?(switch|select|toggle|picker|chooser|menu|dropdown|changer)|\b(i18n|i18next|next-intl|react-intl|useTranslations?|useIntl|useLocale|setLocale|hreflang|accept-language)\b|navigator\.languages?\b/i;

/**
 * Letters and marks of any script other than Latin. `Common` is the punctuation, digits, currency signs, arrows and symbols that
 * have no script of their own (₹ · – — … × ’ “ ” → ✓ and the like); `Inherited` is the combining marks that follow a Latin letter.
 */
const NON_LATIN_SCRIPT = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u;

interface ScriptException {
  readonly file: string;
  /** The characters allowed in that file. */
  readonly characters: string;
  readonly reason: string;
}

/** The one reviewed list of source files that may hold a non-Latin character, each with its reason. Licence texts and the like only. */
const SCRIPT_EXCEPTIONS: ReadonlyArray<ScriptException> = [
  {
    file: 'src/components/features/estimate-review/review-tree.tsx',
    characters: 'Σ',
    reason: 'A code comment that names the sum sign (capital sigma) the legend must not show; it is not a string the screen displays.',
  },
];

interface ScriptFinding {
  readonly file: string;
  readonly line: number;
  readonly character: string;
}

/** The non-Latin characters in the lines of `text`, with their line numbers. */
function findNonLatinCharacters(file: string, lines: ReadonlyArray<string>): ScriptFinding[] {
  const found: ScriptFinding[] = [];
  for (const [index, text] of lines.entries()) {
    // Most lines are plain Latin: one test of the whole line, and only a line that fails it is read character by character.
    if (!NON_LATIN_SCRIPT.test(text)) continue;
    for (const character of text) {
      if (NON_LATIN_SCRIPT.test(character)) found.push({ file, line: index + 1, character });
    }
  }
  return found;
}

const isExcepted = (finding: ScriptFinding, exceptions: ReadonlyArray<ScriptException> = SCRIPT_EXCEPTIONS): boolean =>
  exceptions.some((exception) => exception.file === finding.file && [...exception.characters].includes(finding.character));

/** The names of the dependencies of a package.json text, of every kind. */
function dependencyNames(packageJson: string): string[] {
  const parsed: unknown = JSON.parse(packageJson);
  if (typeof parsed !== 'object' || parsed === null) return [];
  return ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'].flatMap((key) => {
    const section: unknown = Object.entries(parsed).find(([name]) => name === key)?.[1];
    return typeof section === 'object' && section !== null ? Object.keys(section) : [];
  });
}

/** The `lang` values of the `<html>` tags in `text`; `null` for a tag that has none or has a computed one. */
function htmlLanguages(text: string): Array<string | null> {
  // Comment lines are left out (`set once on <html>`), and `<html` must be followed by a space or `>`: a string such as '<html'
  // (a marker an upload check looks for) is not a tag.
  const code = text
    .split(/\r\n|\r|\n/)
    .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
    .join('\n');
  return [...code.matchAll(/<html(?:\s[^>]*)?>/g)].map((tag) => /\blang="([^"]*)"/.exec(tag[0])?.[1] ?? null);
}

let sourceFiles: string[] = [];
let allTracked: string[] = [];

beforeAll(() => {
  allTracked = trackedFiles();
  sourceFiles = textFilesIn(allTracked, SOURCE_SCOPE);
});

describe('AC-5: the page declares English (India)', () => {
  it('the root layout has <html lang="en-IN">, and every <html> tag in the source says so', () => {
    const tags = sourceFiles.filter((file) => file.endsWith('.tsx')).flatMap((file) => htmlLanguages(readFileSync(join(REPOSITORY_ROOT, file), 'utf8')).map((lang) => ({ file, lang })));
    expect(tags.some((tag) => tag.file === 'src/app/layout.tsx')).toBe(true);
    expect(tags.filter((tag) => tag.lang !== PAGE_LANGUAGE)).toEqual([]);
  });

  it('negative control: a tag with another language, or none, is found', () => {
    expect(htmlLanguages('<html lang="hi-IN" className="a">')).toEqual(['hi-IN']);
    expect(htmlLanguages('<html className="a">')).toEqual([null]);
    expect(htmlLanguages('<html lang="en-IN">\n<html lang="en-US">')).toEqual(['en-IN', 'en-US']);
    expect(htmlLanguages(`const markers = ['<script', '<html', '<svg']; <div lang="hi">`)).toEqual([]);
    expect(htmlLanguages('/** Class names set once on `<html>`. */\n * and on <html className="x">')).toEqual([]);
  });
});

describe('AC-5: no internationalisation or locale library', () => {
  it('package.json lists none, among dependencies of any kind', () => {
    const names = dependencyNames(readFileSync(join(REPOSITORY_ROOT, 'package.json'), 'utf8'));
    expect(names.length).toBeGreaterThan(10);
    expect(names.filter((name) => LOCALE_LIBRARY_NAME.test(name))).toEqual([]);
  });

  it('negative control: the usual libraries are recognised by name', () => {
    for (const name of ['next-intl', 'react-intl', 'i18next', 'react-i18next', 'next-i18next', '@lingui/core', '@formatjs/intl', 'typesafe-i18n', 'i18n-js', 'gettext-parser', 'rosetta', 'node-polyglot', 'react-locale']) {
      expect(LOCALE_LIBRARY_NAME.test(name), name).toBe(true);
    }
    for (const name of ['next', 'react', 'zod', 'pino', 'exceljs', 'lucide-react', 'tailwind-merge']) expect(LOCALE_LIBRARY_NAME.test(name), name).toBe(false);
  });

  it('next.config.ts sets no i18n option', () => {
    expect(readFileSync(join(REPOSITORY_ROOT, 'next.config.ts'), 'utf8')).not.toMatch(/\bi18n\b/);
  });
});

describe('AC-5: no locale route segment and no language switcher', () => {
  it('no folder or file under src/app is named for a locale', () => {
    const segments = allTracked
      .filter((path) => path.startsWith('src/app/'))
      .flatMap((path) => path.split('/').slice(2, -1).map((segment) => ({ path, segment })));
    expect(segments.length).toBeGreaterThan(20);
    expect(segments.filter(({ segment }) => LOCALE_SEGMENT.test(segment))).toEqual([]);
  });

  it('negative control: locale-shaped folder names are recognised, ordinary ones are not', () => {
    for (const segment of ['[locale]', '[lang]', '[[...locale]]', '[...lng]', '(locale)', 'en', 'hi', 'ta', 'en-IN', 'HI']) expect(LOCALE_SEGMENT.test(segment), segment).toBe(true);
    for (const segment of ['(portal)', '(public)', 'api', 'v1', 'me', 'estimates', '[code]', '[id]', '[slNo]', '[...nextauth]', 'sign-in', 'fonts', 'account']) {
      expect(LOCALE_SEGMENT.test(segment), segment).toBe(false);
    }
  });

  it('no source file is named for a language switcher or a translation layer, and none uses one', () => {
    const named = sourceFiles.filter((file) => SWITCHER_OR_TRANSLATION.test(file));
    const used = sourceFiles.filter((file) => readLines(REPOSITORY_ROOT, file).some((line) => SWITCHER_OR_TRANSLATION.test(line)));
    expect({ named, used }).toEqual({ named: [], used: [] });
  });

  it('negative control: the switcher and translation names are recognised, ordinary code is not', () => {
    for (const text of ['LanguageSwitcher.tsx', 'locale-select.tsx', 'lang_toggle', 'import { useTranslations } from "next-intl"', 'i18n.config', 'useLocale()', '<link hrefLang="hi">', 'navigator.languages[0]', 'Accept-Language']) {
      expect(SWITCHER_OR_TRANSLATION.test(text), text).toBe(true);
    }
    for (const text of ['count.toLocaleString("en-US")', 'a.localeCompare(b, "en")', 'const language = "English";', 'selected', 'translate(10px)']) {
      expect(SWITCHER_OR_TRANSLATION.test(text), text).toBe(false);
    }
  });
});

describe('AC-5: no character from a non-Latin script in the source', () => {
  it('scans the source: files are found, and no string, comment or style holds a non-Latin letter (licence texts are on the reviewed list, if any)', () => {
    expect(sourceFiles.length).toBeGreaterThan(300);
    const findings = sourceFiles.flatMap((file) => findNonLatinCharacters(file, readLines(REPOSITORY_ROOT, file))).filter((finding) => !isExcepted(finding));
    expect(
      findings.map((finding) => `${finding.file}:${finding.line}: U+${(finding.character.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`),
    ).toEqual([]);
  });

  it('every reviewed exception has a reason and still matches a character in its file', () => {
    for (const exception of SCRIPT_EXCEPTIONS) {
      expect(exception.reason.trim().length, `${exception.file} needs a reason`).toBeGreaterThan(10);
      const present = findNonLatinCharacters(exception.file, readLines(REPOSITORY_ROOT, exception.file));
      expect(present.length, `${exception.file} no longer holds a non-Latin character: remove it from the list`).toBeGreaterThan(0);
    }
  });

  // Written as code points, so that no non-Latin letter sits in this file or in the repository: the negative control builds them.
  const SCRIPTS: ReadonlyArray<readonly [string, number]> = [
    ['Devanagari', 0x0939],
    ['Tamil', 0x0ba4],
    ['Telugu', 0x0c24],
    ['Bengali', 0x0995],
    ['Arabic', 0x0627],
    ['Cyrillic', 0x0436],
    ['Greek', 0x03a9],
    ['Han', 0x4e2d],
    ['Hangul', 0xd55c],
  ];

  it.each(SCRIPTS)('negative control: finds a %s character, with its line', (_script, codePoint) => {
    const planted = String.fromCodePoint(codePoint);
    expect(findNonLatinCharacters('src/x.ts', ['const a = 1;', `const label = 'Save ${planted}';`])).toEqual([{ file: 'src/x.ts', line: 2, character: planted }]);
  });

  it('negative control: finds a Devanagari vowel sign, a combining mark of another script', () => {
    const sign = String.fromCodePoint(0x093e);
    expect(findNonLatinCharacters('src/x.ts', [`x${sign}`])).toHaveLength(1);
  });

  it('allows the rupee sign, common typographic punctuation, accented Latin letters, and symbols', () => {
    const allowed = ['₹', '·', '–', '—', '…', '×', '’', '“', '”', '→', '✓', 'é', 'ü', '°', ' ', '−', '≤'];
    expect(findNonLatinCharacters('src/x.ts', [`Price ₹ 12 ${allowed.join(' ')} é`])).toEqual([]);
  });

  it('a reviewed exception allows its own characters in its own file only', () => {
    const omega = String.fromCodePoint(0x03a9);
    const sigma = String.fromCodePoint(0x03a3);
    const exceptions: ReadonlyArray<ScriptException> = [{ file: 'src/licences/OFL.txt', characters: omega, reason: 'a control for the exception list itself' }];
    expect(isExcepted({ file: 'src/licences/OFL.txt', line: 1, character: omega }, exceptions)).toBe(true);
    expect(isExcepted({ file: 'src/licences/OFL.txt', line: 1, character: sigma }, exceptions)).toBe(false);
    expect(isExcepted({ file: 'src/lib/other.ts', line: 1, character: omega }, exceptions)).toBe(false);
    expect(isExcepted({ file: 'src/lib/other.ts', line: 1, character: omega })).toBe(false);
  });
});
