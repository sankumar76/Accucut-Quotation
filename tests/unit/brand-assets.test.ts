import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { woff2HasGlyph } from '../support/woff2-cmap';

/**
 * STORY-10.02 AC-2 (the real logo, unaltered) and AC-3 (self-hosted fonts, licences, the rupee glyph,
 * preload limited to Plex Sans 400 and 600 and Tinos 700, no font host).
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const path = (relative: string): string => join(ROOT, relative);
const sha256 = (file: string): string => createHash('sha256').update(readFileSync(file)).digest('hex');
const text = (relative: string): string => readFileSync(path(relative), 'utf8').replaceAll('\r\n', '\n');

const FONT_DIRECTORY = 'src/app/fonts';
const SOURCE_FONT_DIRECTORY = 'docs/03-ux/screens/fonts';
const RUPEE_SIGN = 0x20b9;
const fontFiles = readdirSync(path(FONT_DIRECTORY)).filter((name) => name.endsWith('.woff2'));

/** The `localFont({...})` calls of fonts.ts: exported name, source paths, and whether preload is switched off. */
function localFontCalls(): Array<{ name: string; files: string[]; preloadOff: boolean; declaresCurrencyRange: boolean }> {
  const source = text(`${FONT_DIRECTORY}/fonts.ts`);
  return [...source.matchAll(/export const (\w+) = localFont\(\{([\s\S]*?)\n\}\);/g)].map((match) => {
    const body = match[2] ?? '';
    return {
      name: match[1] ?? '',
      files: [...body.matchAll(/path: '\.\/([^']+)'/g)].map((file) => file[1] ?? ''),
      preloadOff: /preload:\s*false/.test(body),
      declaresCurrencyRange: /unicode-range/.test(body) && /U\+20A0-20AB, U\+20AD-20C0/.test(body),
    };
  });
}

describe('logo, AC-2', () => {
  it('AC-2: public/accucut-logo.jpg is byte-identical to the supplied file (same SHA-256)', () => {
    expect(sha256(path('public/accucut-logo.jpg'))).toBe(sha256(path('docs/03-ux/assets/accucut-logo.jpg')));
  });

  it('AC-2: the lockup uses that file with the alt text "AccuCut logo"', () => {
    const source = text('src/components/shared/brand-lockup.tsx');
    expect(source).toContain('src="/accucut-logo.jpg"');
    expect(source).toContain('alt="AccuCut logo"');
    expect(source).toContain('ACCUCUT LASERS');
    expect(source).toContain('Quotation Portal');
    expect(source).toContain('font-brand');
  });
});

describe('fonts, AC-3', () => {
  it('AC-3: every shipped font file is a copy of the one in docs/03-ux/screens/fonts', () => {
    for (const name of fontFiles) {
      expect(sha256(path(`${FONT_DIRECTORY}/${name}`)), name).toBe(sha256(path(`${SOURCE_FONT_DIRECTORY}/${name}`)));
    }
  });

  it('AC-3: both SIL OFL licence files ship beside the fonts', () => {
    for (const name of ['LICENSE-IBM-Plex-OFL.txt', 'LICENSE-Tinos-OFL.txt']) {
      expect(existsSync(path(`${FONT_DIRECTORY}/${name}`)), name).toBe(true);
      expect(text(`${FONT_DIRECTORY}/${name}`)).toMatch(/SIL OPEN FONT LICENSE Version 1\.1/i);
    }
  });

  it('AC-3: each font file is loaded by exactly one next/font/local call, and every file named exists', () => {
    const named = localFontCalls().flatMap((call) => call.files);
    expect([...named].sort()).toEqual([...fontFiles].sort());
  });

  it('AC-3: only Plex Sans 400 and 600 and Tinos 700 are preloaded', () => {
    const preloaded = localFontCalls()
      .filter((call) => !call.preloadOff)
      .flatMap((call) => call.files)
      .sort();
    expect(preloaded).toEqual(['ibm-plex-sans-latin-400-normal.woff2', 'ibm-plex-sans-latin-600-normal.woff2', 'tinos-latin-700-normal.woff2']);
  });

  it('AC-3: the Latin-extended files, which carry the rupee sign, are declared with a currency unicode-range and are not preloaded', () => {
    const calls = localFontCalls().filter((call) => call.files.some((file) => file.includes('-latin-ext-')));
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call.declaresCurrencyRange, call.name).toBe(true);
      expect(call.preloadOff, call.name).toBe(true);
      expect(call.files.every((file) => file.includes('-latin-ext-')), call.name).toBe(true);
    }
  });

  it('AC-3 (UX-13): the rupee sign U+20B9 is in each file that claims it, and the parser does not say yes to everything', () => {
    const claiming = localFontCalls()
      .filter((call) => call.declaresCurrencyRange)
      .flatMap((call) => call.files);
    expect(claiming.length).toBe(4);
    for (const name of claiming) {
      expect(woff2HasGlyph(readFileSync(path(`${FONT_DIRECTORY}/${name}`)), RUPEE_SIGN), name).toBe(true);
    }
    const baseSans = readFileSync(path(`${FONT_DIRECTORY}/ibm-plex-sans-latin-400-normal.woff2`));
    expect(woff2HasGlyph(baseSans, RUPEE_SIGN)).toBe(false);
    expect(woff2HasGlyph(baseSans, 'A'.codePointAt(0) ?? 0)).toBe(true);
  });

  it('AC-3: the base font files hold the characters the screens use (letters, euro, em dash, copyright)', () => {
    for (const name of fontFiles.filter((file) => !file.includes('-latin-ext-') && !file.startsWith('tinos'))) {
      const file = readFileSync(path(`${FONT_DIRECTORY}/${name}`));
      for (const codePoint of [0x41, 0x20ac, 0x2014, 0xa9]) {
        expect(woff2HasGlyph(file, codePoint), `${name} U+${codePoint.toString(16)}`).toBe(true);
      }
    }
  });

  it('AC-3: no source file asks a font host for a font', () => {
    const files = ['src/app/layout.tsx', 'src/app/globals.css', 'src/app/fonts/fonts.ts'];
    for (const file of files) {
      const source = text(file);
      expect(source, file).not.toMatch(/fonts\.googleapis|fonts\.gstatic|next\/font\/google|use\.typekit|@import\s+url\(/);
    }
  });
});
