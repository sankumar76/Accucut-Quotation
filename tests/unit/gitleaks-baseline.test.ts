import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { BASELINE_KEYS, toBaseline } from '../../scripts/lib/gitleaks-baseline';

/**
 * AC-5 / delivery lead's decision of 2026-11-02: the baseline accepts exactly six findings and
 * stores no matched text.
 */

const BASELINE_FILE = fileURLToPath(new URL('../../.gitleaks-baseline.json', import.meta.url));
const ACCEPTED_LOCATIONS = [
  'ACCUCUT_QUOTATION_PORTAL_REQUIREMENTS.md:35',
  'ACCUCUT_QUOTATION_PORTAL_REQUIREMENTS.md:35',
  'docs/01-discovery/requirements-catalog.md:224',
  'docs/01-discovery/requirements-catalog.md:241',
  'docs/01-discovery/requirements-catalog.md:244',
  'ACCUCUT_QUOTATION_PORTAL_REQUIREMENTS.md:35',
];

const rawEntry = {
  RuleID: 'generic-api-key',
  Description: 'Detected a Generic API Key',
  StartLine: 3,
  EndLine: 3,
  StartColumn: 1,
  EndColumn: 20,
  File: 'docs/example.md',
  Commit: 'abc123',
  Author: 'someone',
  Email: 'someone@example.test',
  Date: '2026-11-02T00:00:00Z',
  Message: 'a commit message',
  Entropy: 3.5,
  Fingerprint: 'abc123:docs/example.md:generic-api-key:3',
  Match: 'password, THE-MATCHED-TEXT',
  Secret: 'THE-MATCHED-TEXT',
  Link: 'https://example.test',
  Tags: [],
};

describe('toBaseline', () => {
  it('drops the matched text and every key a baseline does not need', () => {
    const [entry] = toBaseline([rawEntry]);
    expect(Object.keys(entry ?? {}).sort()).toEqual([...BASELINE_KEYS].sort());
    expect(JSON.stringify(entry)).not.toContain('THE-MATCHED-TEXT');
  });

  it('refuses a report entry that lacks a field Gitleaks needs to recognise the finding', () => {
    const incomplete = Object.fromEntries(Object.entries(rawEntry).filter(([key]) => key !== 'Fingerprint'));
    expect(() => toBaseline([incomplete])).toThrow();
  });

  it('orders entries by fingerprint so a regenerated file diffs cleanly', () => {
    const second = { ...rawEntry, Fingerprint: 'zzz:b:r:1' };
    const first = { ...rawEntry, Fingerprint: 'aaa:a:r:1' };
    expect(toBaseline([second, first]).map((entry) => entry.Fingerprint)).toEqual(['aaa:a:r:1', 'zzz:b:r:1']);
  });
});

describe('the committed baseline', () => {
  const entries = toBaseline(JSON.parse(readFileSync(BASELINE_FILE, 'utf8')));

  it('holds exactly the six accepted findings, all documentation', () => {
    expect(entries).toHaveLength(6);
    expect(entries.map((entry) => `${entry.File}:${entry.StartLine}`).sort()).toEqual([...ACCEPTED_LOCATIONS].sort());
    expect(new Set(entries.map((entry) => entry.RuleID))).toEqual(new Set(['generic-api-key']));
    for (const entry of entries) expect(entry.File).toMatch(/\.md$/);
  });

  it('stores no matched text', () => {
    const text = readFileSync(BASELINE_FILE, 'utf8');
    expect(text).not.toMatch(/"(Match|Secret)"/);
    expect(text).not.toContain('REDACTED');
  });
});
