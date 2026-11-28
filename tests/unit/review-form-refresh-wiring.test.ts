import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * DEF-150 (AQP-507; DL-481): the Lead's form asks for the page to be drawn again after the first save (and a rename), after a quiet period. That refresh is asked for at one address and goes only while the page is
 * still there: a navigation made in between (a row link) draws the page for the new address itself, and a refresh sent for the old one would commit after it and put the earlier row back. The timing is judged in a
 * browser (estimate-review-refresh-race.spec.ts); this pins the rule in the source, as the project's other wiring tests do.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SOURCE = readFileSync(`${ROOT}src/components/features/estimate-workspace/review-form.tsx`, 'utf8').replaceAll('\r\n', '\n');

describe('DEF-150: a refresh never overwrites a navigation made after it was asked for', () => {
  it('records the address when the refresh is asked for and sends it only if the page is still at that address', () => {
    expect(SOURCE).toContain('const addressNow = (): string =>');
    expect(SOURCE).toMatch(/asked\.current = addressNow\(\);/);
    expect(SOURCE).toMatch(/if \(addressNow\(\) !== asked\.current\) return;\s+startRefresh\(\(\) => router\.refresh\(\)\);/);
  });

  it('keeps the quiet period as it was (no budget changes, DL-404)', () => {
    expect(SOURCE).toContain('const REFRESH_QUIET_MS = 300;');
  });
});
