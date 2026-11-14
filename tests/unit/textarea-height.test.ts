import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { blocksOf, customProperties } from '../support/css-tokens';

/**
 * STORY-05.04 AC-4, follow-up #395: the theme replaces the spacing scale (`--spacing-*: initial` in globals.css), so a size of the default scale such as `min-h-24` is a class that
 * does nothing, and Remarks (a multi-line box) had no minimum height. The minimum is a named token, and the component reads the token.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8').replaceAll('\r\n', '\n');

describe('the least height of the multi-line box', () => {
  const tokens = customProperties(blocksOf(read('src/app/globals.css'), ':root')[0] ?? '');
  const component = read('src/components/ui/textarea.tsx');

  it('is a token of the token file: three lines of body text, 96 px', () => {
    expect(tokens.get('--textarea-min-h')).toBe('96px');
  });

  it('is read from the token by the Textarea, and not from a size of the default scale, which this theme does not have', () => {
    expect(component).toContain('min-h-(--textarea-min-h)');
    expect(component).not.toMatch(/\bmin-h-\d/);
  });
});
