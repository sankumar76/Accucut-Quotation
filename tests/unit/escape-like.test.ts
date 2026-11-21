import { describe, expect, it } from 'vitest';

import { escapeLike } from '@/lib/escape-like';

/** STORY-04.06 AC-3: a typed `%`, `_` or backslash is searched as itself. The effect on real rows is `tests/integration/tasks/queue-filters.test.ts`. */
describe('escapeLike', () => {
  it('puts a backslash in front of the percent sign, the underscore and the backslash', () => {
    expect(escapeLike('50%')).toBe(String.raw`50\%`);
    expect(escapeLike('Plate_A')).toBe(String.raw`Plate\_A`);
    expect(escapeLike(String.raw`a\b`)).toBe(String.raw`a\\b`);
    expect(escapeLike('%_%')).toBe(String.raw`\%\_\%`);
  });

  it('leaves every other text as it is', () => {
    expect(escapeLike('Hopper cover Q-2026-0001')).toBe('Hopper cover Q-2026-0001');
    expect(escapeLike('')).toBe('');
  });
});
