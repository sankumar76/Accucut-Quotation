import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { EnvValidationError, loadEmailFeature } from '@/lib/env';

/**
 * STORY-09.01 AC-6: `FEATURE_EMAIL` is `on` or `off`, and `off` is the default (absent, empty). Any other value stops the process at start-up, like any invalid setting, and the
 * error names the variable and never its value. The flag is not a secret, so it is not in `ENV_VARIABLE_NAMES`.
 */

describe('loadEmailFeature (AC-6)', () => {
  it('AC-6: is off when the variable is absent', () => {
    expect(loadEmailFeature({})).toBe(false);
  });

  it('AC-6: is off when the variable is empty (`FEATURE_EMAIL=` in a template)', () => {
    expect(loadEmailFeature({ FEATURE_EMAIL: '' })).toBe(false);
  });

  it('AC-6: is off for `off`, and on for `on`', () => {
    expect(loadEmailFeature({ FEATURE_EMAIL: 'off' })).toBe(false);
    expect(loadEmailFeature({ FEATURE_EMAIL: 'on' })).toBe(true);
  });

  it.each(['ON', 'true', '1', 'yes', ' on'])('AC-6: refuses %j, naming the variable and not the value', (value) => {
    let caught: unknown;
    try {
      loadEmailFeature({ FEATURE_EMAIL: value });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(EnvValidationError);
    expect(caught instanceof Error ? caught.message : '').toContain('FEATURE_EMAIL (invalid)');
    expect(caught instanceof Error ? caught.message : '').not.toContain(`(${value})`);
  });
});

describe('.env.example (AC-6, SQR-01)', () => {
  it('AC-6: names FEATURE_EMAIL and ships it off, so a new install does not schedule mail jobs by default', () => {
    const text = readFileSync(fileURLToPath(new URL('../../../.env.example', import.meta.url)), 'utf8');
    const line = text.split(/\r?\n/).find((candidate) => candidate.startsWith('FEATURE_EMAIL='));
    expect(line, 'FEATURE_EMAIL line is missing from .env.example').toBeDefined();
    expect(line).toBe('FEATURE_EMAIL=off');
  });
});
