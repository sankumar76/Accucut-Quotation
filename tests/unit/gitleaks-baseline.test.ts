import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { BASELINE_KEYS, fingerprintOf, inconsistentEntries, toBaseline } from '../../scripts/lib/gitleaks-baseline';

/**
 * AC-5 / delivery lead's decision of 2026-11-02: the baseline accepts exactly seven findings and stores
 * no matched text. The seven are pinned by fingerprint, which holds the commit as well as the place
 * (QLT-11): an entry pointed at another commit, file or line fails here.
 */

const BASELINE_FILE = fileURLToPath(new URL('../../.gitleaks-baseline.json', import.meta.url));

const ACCEPTED_FINGERPRINTS = [
  '09f39636ee68d73dacd72e2c34d1ffe7c9866a37:ACCUCUT_QUOTATION_PORTAL_REQUIREMENTS.md:generic-api-key:35',
  '09f39636ee68d73dacd72e2c34d1ffe7c9866a37:docs/01-discovery/requirements-catalog.md:generic-api-key:244',
  '315ea943fcd7a443faf0aa483683fc7eafe91d8d:docs/01-discovery/requirements-catalog.md:generic-api-key:224',
  '338ce9a5129094d19bbe97366f533a40e8b100c8:ACCUCUT_QUOTATION_PORTAL_REQUIREMENTS.md:generic-api-key:35',
  '338ce9a5129094d19bbe97366f533a40e8b100c8:docs/01-discovery/requirements-catalog.md:generic-api-key:241',
  // Added by the delivery lead's decision of 2026-11-02: a README line in a commit already pushed.
  'b51364378d9a49a20f2cfa7b1db75e0f8321abf2:README.md:generic-api-key:74',
  'c7576f0e536abd9e8581c6e9b3c73bc760661a2c:ACCUCUT_QUOTATION_PORTAL_REQUIREMENTS.md:generic-api-key:35',
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

describe('inconsistentEntries (QLT-11, negative control)', () => {
  const [entry] = toBaseline([rawEntry]);

  it('accepts an entry whose fingerprint names its own commit, file, rule and line', () => {
    expect(entry && fingerprintOf(entry)).toBe(rawEntry.Fingerprint);
    expect(inconsistentEntries(entry ? [entry] : [])).toEqual([]);
  });

  it.each([
    ['another commit', { Commit: 'def456' }],
    ['another file', { File: 'docs/other.md' }],
    ['another line', { StartLine: 4 }],
    ['another rule', { RuleID: 'github-pat' }],
  ])('flags an entry edited to name %s while its fingerprint still names the old one', (_name, change) => {
    const tampered = toBaseline([{ ...rawEntry, ...change }]);
    expect(inconsistentEntries(tampered)).toEqual([rawEntry.Fingerprint]);
  });
});

describe('the committed baseline', () => {
  const entries = toBaseline(JSON.parse(readFileSync(BASELINE_FILE, 'utf8')));

  it('holds exactly the seven accepted fingerprints', () => {
    expect(entries.map((entry) => entry.Fingerprint)).toEqual([...ACCEPTED_FINGERPRINTS].sort());
  });

  it('QLT-11: every entry matches its own fingerprint, so none accepts a different finding', () => {
    expect(inconsistentEntries(entries)).toEqual([]);
  });

  it('accepts only documentation findings of one rule', () => {
    expect(new Set(entries.map((entry) => entry.RuleID))).toEqual(new Set(['generic-api-key']));
    for (const entry of entries) expect(entry.File).toMatch(/\.md$/);
  });

  it('stores no matched text', () => {
    const text = readFileSync(BASELINE_FILE, 'utf8');
    expect(text).not.toMatch(/"(Match|Secret)"/);
    expect(text).not.toContain('REDACTED');
  });
});
