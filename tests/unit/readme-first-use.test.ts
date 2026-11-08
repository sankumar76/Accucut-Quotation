import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * STORY-02.01 AC-9 (architecture section 5.6, "One limit"): the "First use" section of `README.md` tells the Admin to enter all 15
 * rates before any estimate is calculated, and says why. A rate left at 0 is a valid value, so no check in the portal can tell an
 * estimate priced before the rates were typed from one priced on purpose; this sentence is the only control, and so a test holds it.
 */

const README = fileURLToPath(new URL('../../README.md', import.meta.url));

/** The text from the "First use" heading to the next second-level heading, with line breaks and runs of spaces made into single spaces. */
function firstUseSection(): string {
  const text = readFileSync(README, 'utf8').replace(/\r\n/g, '\n');
  const start = text.indexOf('\n## First use');
  expect(start, 'the README has a "First use" section').toBeGreaterThanOrEqual(0);
  const next = text.indexOf('\n## ', start + 1);
  return text
    .slice(start, next === -1 ? undefined : next)
    .replace(/\s+/g, ' ')
    .trim();
}

describe('AC-9: the First use section of the README', () => {
  it('tells the Admin to enter all 15 rates before any estimate is calculated', () => {
    expect(firstUseSection()).toContain('Enter all 15 rates before any estimate is calculated.');
  });

  it('says why: a rate left at 0 is a valid value, so an estimate calculated before it is entered prices that process at 0 with no message', () => {
    const section = firstUseSection();
    expect(section).toContain('a rate left at 0 is a valid value');
    expect(section).toContain('an estimate calculated before it is entered prices that process at 0');
    expect(section).toContain('the portal shows no message');
  });

  it('says where to type them, and that the values are never put in the repository', () => {
    const section = firstUseSection();
    expect(section).toContain('Masters, Process master');
    expect(section).toContain('/masters/process');
    expect(section).toContain('never put in this repository');
  });

  it('puts the field registry step in the commands, because the Process master reads it to say which formulas use a rate', () => {
    expect(firstUseSection()).toContain('scripts/ensure-seed-version.ts');
  });
});
