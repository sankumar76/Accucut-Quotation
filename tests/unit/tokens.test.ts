import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { contrastRatio } from '@/lib/contrast';
import { COLOUR_TOKENS, CONTRAST_PAIRS, type StatedContrastPair } from '@/lib/design-tokens';

import { blocksOf, customProperties, stripComments } from '../support/css-tokens';

/**
 * STORY-10.02 AC-1 (NFR-020): the colour, type, spacing, radius and control-height tokens are named once, in
 * src/app/globals.css, match docs/03-ux/screens/screens.css, hold no hard-coded colour or pixel font size
 * elsewhere, and every text-and-background pair of UX spec section 7.3 meets the ratio stated there.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8').replaceAll('\r\n', '\n');

const GLOBALS = read('src/app/globals.css');
const SCREENS = read('docs/03-ux/screens/screens.css');

const globalsRoot = customProperties(blocksOf(GLOBALS, ':root')[0] ?? '');
const screensRoot = customProperties(blocksOf(SCREENS, ':root')[0] ?? '');

/** Tokens whose value is deliberately not copied: the font stacks are built from next/font variables. */
const NOT_COMPARED = new Set(['--font-sans', '--font-mono', '--font-brand']);

function valueOf(name: string): string {
  const value = globalsRoot.get(name);
  if (value === undefined) throw new Error(`${name} is not defined in globals.css :root`);
  return value;
}

describe('design tokens, AC-1', () => {
  it('AC-1: every token of screens.css :root is in globals.css with the same value', () => {
    const differences = [...screensRoot]
      .filter(([name]) => !NOT_COMPARED.has(name))
      .filter(([name, value]) => globalsRoot.get(name) !== value)
      .map(([name, value]) => `${name}: screens.css "${value}", globals.css "${globalsRoot.get(name) ?? 'missing'}"`);
    expect(differences).toEqual([]);
  });

  it('QLT-10: the token :root block is not inside an @layer (the radius theme names point at it)', () => {
    const text = stripComments(GLOBALS);
    const beforeTokens = text.slice(0, text.indexOf(':root {'));
    const opened = (beforeTokens.match(/@layer[^{]*{/g) ?? []).length;
    const closed = (beforeTokens.match(/}/g) ?? []).length;
    expect(opened).toBe(closed);
    expect(globalsRoot.size).toBeGreaterThan(40);
  });

  it('AC-1: four type sizes, with the 24/32 heading on phones', () => {
    expect([valueOf('--fs-heading'), valueOf('--lh-heading')]).toEqual(['28px', '36px']);
    expect([valueOf('--fs-sub'), valueOf('--lh-sub')]).toEqual(['18px', '26px']);
    expect([valueOf('--fs-body'), valueOf('--lh-body')]).toEqual(['14px', '22px']);
    expect([valueOf('--fs-label'), valueOf('--lh-label')]).toEqual(['12px', '16px']);
    const phone = customProperties(blocksOf(GLOBALS, ':root')[1] ?? '');
    expect([phone.get('--fs-heading'), phone.get('--lh-heading')]).toEqual(['24px', '32px']);
    expect(GLOBALS).toMatch(/@media \(max-width: 767px\)/);
  });

  it('AC-1: a 4-point spacing scale of 4, 8, 12, 16, 24, 32 and 48', () => {
    const scale = ['--s-1', '--s-2', '--s-3', '--s-4', '--s-5', '--s-6', '--s-7'].map(valueOf);
    expect(scale).toEqual(['4px', '8px', '12px', '16px', '24px', '32px', '48px']);
  });

  it('AC-1: radii of 4, 8 and 12 and one control height of 44 px', () => {
    expect([valueOf('--radius-sm'), valueOf('--radius'), valueOf('--radius-lg')]).toEqual(['4px', '8px', '12px']);
    expect(valueOf('--control-h')).toBe('44px');
  });

  it('AC-1: every colour token named for the design system page exists in globals.css', () => {
    const missing = COLOUR_TOKENS.map((token) => token.name).filter((name) => !globalsRoot.has(name));
    expect(missing).toEqual([]);
  });

  it('AC-1: the contrast pairs name tokens that exist', () => {
    const names = CONTRAST_PAIRS.flatMap((pair) => [pair.foreground, pair.background]);
    expect(names.filter((name) => !globalsRoot.has(name))).toEqual([]);
  });

  describe('contrast of the pairs in UX spec section 7.3', () => {
    it.each(CONTRAST_PAIRS)('AC-1: $foreground on $background meets $minimum:1 ($note)', (pair) => {
      const ratio = contrastRatio(valueOf(pair.foreground), valueOf(pair.background));
      expect(ratio).toBeGreaterThanOrEqual(pair.minimum);
    });

    it.each(CONTRAST_PAIRS.filter((pair): pair is StatedContrastPair => pair.stated !== undefined))(
      'AC-1: $foreground on $background is the $stated:1 that UX spec section 7.3 prints',
      (pair) => {
        const ratio = contrastRatio(valueOf(pair.foreground), valueOf(pair.background));
        expect(Math.abs(ratio - pair.stated)).toBeLessThanOrEqual(0.005);
      },
    );
  });

  describe('no hard-coded colour or pixel font size outside the token file', () => {
    function sourceFiles(directory: string): string[] {
      return readdirSync(directory).flatMap((name) => {
        const path = join(directory, name);
        if (statSync(path).isDirectory()) return name === 'generated' ? [] : sourceFiles(path);
        return /\.(tsx?|css)$/.test(name) ? [path] : [];
      });
    }

    /**
     * Every source file outside globals.css, read once. The walk and the reads run in a hook (120 s hook limit,
     * vitest.config.ts) and not in the tests, because on a loaded machine reading the whole tree took longer than a
     * test's own 5 s (DEF-012, test strategy section 10). The tests only match text that is already in memory.
     */
    let sources: ReadonlyArray<{ readonly label: string; readonly lines: ReadonlyArray<string> }> = [];
    beforeAll(() => {
      sources = sourceFiles(join(ROOT, 'src'))
        .map((path) => ({ path, label: relative(ROOT, path).replaceAll('\\', '/') }))
        .filter(({ label }) => label !== 'src/app/globals.css')
        .map(({ path, label }) => ({ label, lines: readFileSync(path, 'utf8').split(/\r?\n/) }));
    });

    const HEX_COLOUR = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/;
    const COLOUR_FUNCTION = /\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/;
    const PIXEL_FONT_SIZE = /text-\[\s*\d+(?:\.\d+)?px\s*\]|font-size\s*:\s*\d|fontSize\s*:/;

    function offences(pattern: RegExp): string[] {
      return sources.flatMap(({ label, lines }) =>
        lines.flatMap((line, index) => (pattern.test(line) ? [`${label}:${index + 1}: ${line.trim()}`] : [])),
      );
    }

    it('AC-1: the scan reads the source tree (so an empty scan cannot pass for a clean one)', () => {
      expect(sources.length).toBeGreaterThan(50);
      expect(sources.some(({ label }) => label === 'src/lib/design-tokens.ts')).toBe(true);
      expect(sources.some(({ label }) => label === 'src/app/globals.css')).toBe(false);
    });

    it('AC-1: finds 0 hex colours in src outside globals.css', () => {
      expect(offences(HEX_COLOUR)).toEqual([]);
    });

    it('AC-1: finds 0 rgb(), hsl() or similar colour functions in src outside globals.css', () => {
      expect(offences(COLOUR_FUNCTION)).toEqual([]);
    });

    it('AC-1: finds 0 pixel font sizes in src outside globals.css', () => {
      expect(offences(PIXEL_FONT_SIZE)).toEqual([]);
    });

    it('AC-1: the scan itself catches each kind of offence', () => {
      expect(HEX_COLOUR.test('color: #DE3030;')).toBe(true);
      expect(HEX_COLOUR.test('href="#main"')).toBe(false);
      expect(COLOUR_FUNCTION.test('background: rgba(0, 0, 0, .5)')).toBe(true);
      expect(PIXEL_FONT_SIZE.test('className="text-[13px]"')).toBe(true);
      expect(PIXEL_FONT_SIZE.test('className="text-body"')).toBe(false);
    });
  });
});
