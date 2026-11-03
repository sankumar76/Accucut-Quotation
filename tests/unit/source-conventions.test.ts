import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Conventions the design system sets for every later screen (G6 findings STD-08, STD-09, STD-10 on AQP-28). They are
 * checked by reading source text, because Vitest cannot render a component.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return name === 'generated' ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

const FILES = sourceFiles(join(ROOT, 'src')).map((path) => ({
  name: relative(ROOT, path).replaceAll('\\', '/'),
  lines: readFileSync(path, 'utf8').split(/\r?\n/),
}));

function offences(pattern: RegExp, except: ReadonlyArray<string> = []): string[] {
  return FILES.filter((file) => !except.includes(file.name)).flatMap((file) =>
    file.lines.flatMap((text, index) => (pattern.test(text) ? [`${file.name}:${index + 1}: ${text.trim()}`] : [])),
  );
}

describe('icons (STD-08)', () => {
  it('no icon sets aria-hidden or focusable by hand: lucide-react hides an icon that has no accessible name', () => {
    expect(offences(/focusable="false"|<[A-Z]\w* aria-hidden="true" /)).toEqual([]);
  });

  it('no icon has a bare pixel size: sizes are named roles in ICON_SIZE (src/lib/design-tokens.ts)', () => {
    expect(offences(/\bsize=\{\d+\}/)).toEqual([]);
  });
});

describe('class names (STD-10)', () => {
  it('class names are joined with cn(), never with a template literal that can print "undefined"', () => {
    expect(offences(/className=\{`/)).toEqual([]);
  });
});

describe('layout numbers (STD-09)', () => {
  it('no z-index literal: the stacking order is the --z-* tokens in globals.css', () => {
    expect(offences(/\bz-(?:\d+|\[\d+\])/)).toEqual([]);
  });

  it('the 1024 px menu breakpoint is written once, in design-tokens.ts', () => {
    expect(offences(/min-width:\s*1024px/, ['src/app/globals.css'])).toEqual([]);
  });
});
