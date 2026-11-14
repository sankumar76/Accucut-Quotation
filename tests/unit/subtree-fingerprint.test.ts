import { describe, expect, it } from 'vitest';

import { FINGERPRINT_PATTERN, subtreeFingerprint } from '@/lib/estimate/subtree-fingerprint';

/** STORY-05.02 review SQR-01: the fingerprint of the parts a delete would remove. Every ID is invented. */

const A = { id: '00000000-0000-4000-8000-0000000000a1', revision: 1 };
const B = { id: '00000000-0000-4000-8000-0000000000a2', revision: 1 };
const C = { id: '00000000-0000-4000-8000-0000000000a3', revision: 1 };

describe('subtreeFingerprint', () => {
  it('is 16 lower-case hexadecimal digits', () => {
    expect(subtreeFingerprint([A, B])).toMatch(FINGERPRINT_PATTERN);
    expect(subtreeFingerprint([])).toMatch(FINGERPRINT_PATTERN);
  });

  it('does not depend on the order the parts are given in, or on the letter case of an ID', () => {
    expect(subtreeFingerprint([A, B, C])).toBe(subtreeFingerprint([C, A, B]));
    expect(subtreeFingerprint([{ ...A, id: A.id.toUpperCase() }, B])).toBe(subtreeFingerprint([A, B]));
  });

  it('changes when a member is replaced by another (the same count), when one is added or left out, and when one part has a new revision', () => {
    const base = subtreeFingerprint([A, B]);
    expect(subtreeFingerprint([A, C])).not.toBe(base);
    expect(subtreeFingerprint([A, B, C])).not.toBe(base);
    expect(subtreeFingerprint([A])).not.toBe(base);
    expect(subtreeFingerprint([A, { ...B, revision: 2 }])).not.toBe(base);
  });

  it('is a fixed value for a fixed input (64-bit FNV-1a of the sorted "id:revision" list), so the browser and the server cannot drift apart', () => {
    expect(subtreeFingerprint([B, A])).toBe('61f703ce75ac3118');
  });
});
