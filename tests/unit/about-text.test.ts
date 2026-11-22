import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AboutCard } from '@/components/features/about/about-card';
import { ABOUT_COPYRIGHT, ABOUT_DESCRIPTION, ABOUT_VERSION } from '@/lib/about-text';

import { forbiddenStrings, NEGATIVE_CONTROL_SENTINEL, negativeControlForbidden } from '../support/canary-masters';
import { describeFinding, scanResponses, type RecordedResponse } from '../support/scanner';

/**
 * STORY-01.08 (AQP-90) T1, AC-1 and AC-4: the words of SCR-24 "About" are compared with the approved text. The three sentences below are copied
 * character for character from SPEC section 9, the row "About" (`ACCUCUT_QUOTATION_PORTAL_REQUIREMENTS.md`), and are written out here on purpose: a
 * test that imported them from the source would pass for any change. They are the delivery lead's own words ("The wording is fine.", D-18), so a
 * curly quote, a changed word or a trailing space is a failure. The copyright sign is U+00A9 (written with its escape so an editor cannot swap it).
 */

const SPEC_DESCRIPTION =
  'The Accucut RFQ Portal helps Accucut Lasers prepare, review and approve manufacturing cost estimates. Engineers enter part details, the portal does the calculation, and a Lead or Admin reviews and approves the estimate.';
const SPEC_VERSION = 'Version No: 1.0';
const SPEC_COPYRIGHT = '\u00a9 Accucut Lasers Pvt Ltd. All rights reserved.';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
/** The source of a file with its comments removed, so a sentence that explains why the version is not read from `package.json` does not count as reading it. */
const code = (relative: string): string =>
  readFileSync(`${ROOT}${relative}`, 'utf8')
    .replaceAll('\r\n', '\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/** The text of rendered markup: the tags removed, the entities that React writes read back, the text of each element on its own line. */
function textLines(markup: string): string[] {
  return markup
    .replace(/<[^>]+>/g, '\n')
    .replaceAll('&amp;', '&')
    .replaceAll('&#x27;', "'")
    .replaceAll('&quot;', '"')
    .split('\n')
    .filter((line) => line !== '');
}

describe('the constants of SPEC section 9 (AC-1, AC-4)', () => {
  it('AC-1: the description is the approved sentence, exactly', () => {
    expect(ABOUT_DESCRIPTION).toBe(SPEC_DESCRIPTION);
  });

  it('AC-1, AC-4: the version line is exactly "Version No: 1.0"', () => {
    expect(ABOUT_VERSION).toBe(SPEC_VERSION);
  });

  it('AC-1: the copyright line is exactly the approved line, with the copyright sign U+00A9', () => {
    expect(ABOUT_COPYRIGHT).toBe(SPEC_COPYRIGHT);
    expect(ABOUT_COPYRIGHT.codePointAt(0)).toBe(0xa9);
  });

  it('AC-1: no constant has a leading or trailing space, a curly quote or a double space', () => {
    for (const text of [ABOUT_DESCRIPTION, ABOUT_VERSION, ABOUT_COPYRIGHT]) {
      expect(text).toBe(text.trim());
      expect(text).not.toMatch(/[\u2018\u2019\u201c\u201d]|\s{2}/);
    }
  });
});

describe('the card shows the words (AC-1)', () => {
  const lines = textLines(renderToStaticMarkup(createElement(AboutCard)));

  it('AC-1: the lockup, the sentence, the version and the copyright line appear in this order, each as its own text', () => {
    expect(lines).toEqual(['ACCUCUT LASERS', 'RFQ Portal', SPEC_DESCRIPTION, SPEC_VERSION, SPEC_COPYRIGHT]);
  });

  it('AC-1: the logo is the supplied file, with its text alternative', () => {
    const markup = renderToStaticMarkup(createElement(AboutCard));
    expect(markup).toContain('src="/accucut-logo.jpg"');
    expect(markup).toContain('alt="AccuCut logo"');
  });

  it('AC-1: the subtitle of the lockup is not hidden on a phone, because the card has room for it', () => {
    const markup = renderToStaticMarkup(createElement(AboutCard));
    const subtitle = /<span class="([^"]*)">RFQ Portal<\/span>/.exec(markup)?.[1] ?? '';
    expect(subtitle).not.toBe('');
    expect(subtitle.split(' ')).not.toContain('hidden');
  });

  it('AC-1: the card has no heading, so the page title is the one h1', () => {
    expect(renderToStaticMarkup(createElement(AboutCard))).not.toMatch(/<h[1-6][ >]/);
  });
});

describe('the version is its own constant (AC-4)', () => {
  it('AC-4: neither the text nor the card nor the page reads package.json or the npm version', () => {
    for (const file of ['src/lib/about-text.ts', 'src/components/features/about/about-card.tsx', 'src/app/(portal)/about/page.tsx']) {
      expect(code(file), file).not.toMatch(/package\.json|npm_package_version|process\.env|APP_VERSION/);
    }
  });
});

describe('the Engineer scan finds nothing on the page (AC-3, NFR-002)', () => {
  // The same forbidden list and the same scanner as the end-to-end scan (`tests/e2e/canary-scan.spec.ts`), applied to the markup of the card: the word "cost" in the
  // approved sentence is not on the list, because the list holds values, rate names and formula markers, never a word of the page.
  const asResponse = (body: string): RecordedResponse => ({ label: 'GET /about (page)', url: 'https://portal.example.test/about', status: 200, headers: {}, body, carriedSession: true });
  const markup = renderToStaticMarkup(createElement(AboutCard));

  it('AC-3: the card holds no sentinel, rate name, operand name or formula marker', () => {
    expect(scanResponses([asResponse(markup)], forbiddenStrings([])).map(describeFinding)).toEqual([]);
  });

  it('AC-3: the sentence holds no figure but the version: the only digits on the card are those of "1.0"', () => {
    expect(textLines(markup).join(' ').match(/\d+(?:\.\d+)?/g)).toEqual(['1.0']);
  });

  it('negative control: the same scan reports a sentinel planted in the markup, so a clean result is worth something', () => {
    const planted = scanResponses([asResponse(`${markup}<p>${NEGATIVE_CONTROL_SENTINEL}</p>`)], negativeControlForbidden());
    expect(planted.length).toBeGreaterThan(0);
  });
});
