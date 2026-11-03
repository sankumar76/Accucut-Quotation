import localFont from 'next/font/local';

/**
 * Self-hosted fonts (STORY-10.02, AC-3, UX spec section 7.1, architecture section 11). No request goes to a
 * font host. The files are the open-licence (SIL OFL 1.1) Latin subsets from docs/03-ux/screens/fonts/; the
 * licence texts sit beside them (LICENSE-IBM-Plex-OFL.txt, LICENSE-Tinos-OFL.txt).
 *
 * Preload: only IBM Plex Sans 400 and 600 and Tinos 700 are preloaded (`preload: true`, the default).
 * Mono and the rupee files are not, and load when the page uses them.
 *
 * The rupee sign (U+20B9) is in none of the Latin files. It comes from the Latin-extended subsets, declared
 * with `unicode-range` so a page with no rupee sign never fetches them. They are separate families listed
 * BEFORE the base family in the font stack (globals.css): the range sends only currency signs to them, and the
 * base family's own fallback faces (which hold a rupee sign too) can not answer for it first.
 *
 * next/font reads each option as a literal, so the range is written out in both places.
 * tests/unit/brand-assets.test.ts reads the font files to prove which ones hold the glyph.
 */

export const plexSans = localFont({
  src: [
    { path: './ibm-plex-sans-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './ibm-plex-sans-latin-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  variable: '--nf-plex-sans',
  fallback: ['system-ui', 'Segoe UI', 'sans-serif'],
});

export const plexSansRupee = localFont({
  src: [
    { path: './ibm-plex-sans-latin-ext-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './ibm-plex-sans-latin-ext-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  preload: false,
  declarations: [{ prop: 'unicode-range', value: 'U+20A0-20AB, U+20AD-20C0' }],
  variable: '--nf-plex-sans-rupee',
  adjustFontFallback: false,
});

export const plexMono = localFont({
  src: [
    { path: './ibm-plex-mono-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './ibm-plex-mono-latin-500-normal.woff2', weight: '500', style: 'normal' },
  ],
  display: 'swap',
  preload: false,
  variable: '--nf-plex-mono',
  fallback: ['ui-monospace', 'Consolas', 'monospace'],
});

export const plexMonoRupee = localFont({
  src: [
    { path: './ibm-plex-mono-latin-ext-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './ibm-plex-mono-latin-ext-500-normal.woff2', weight: '500', style: 'normal' },
  ],
  display: 'swap',
  preload: false,
  declarations: [{ prop: 'unicode-range', value: 'U+20A0-20AB, U+20AD-20C0' }],
  variable: '--nf-plex-mono-rupee',
  adjustFontFallback: false,
});

export const tinos = localFont({
  src: [{ path: './tinos-latin-700-normal.woff2', weight: '700', style: 'normal' }],
  display: 'swap',
  variable: '--nf-tinos',
  adjustFontFallback: 'Times New Roman',
  fallback: ['Times New Roman', 'Times', 'serif'],
});

/** Class names that define the five `--nf-*` variables; set once on `<html>`. */
export const FONT_VARIABLE_CLASSES = [
  plexSans.variable,
  plexSansRupee.variable,
  plexMono.variable,
  plexMonoRupee.variable,
  tinos.variable,
].join(' ');
