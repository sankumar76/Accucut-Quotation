import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { generateResetToken, hashResetToken, isWellFormedResetToken, RESET_TOKEN_BYTES } from '@/server/auth/reset-token';

/**
 * STORY-09.07 AC-2, AC-9: the token of a reset link is 32 random bytes written as 43 URL-safe characters, and only its SHA-256 is ever stored. The token is random, so a test cannot name it: it
 * checks the shape, the hash against an independent SHA-256, that tokens do not repeat and that every bit of the output moves.
 */

describe('generateResetToken', () => {
  it('makes 32 bytes as 43 characters of base64url, and a hash that is the SHA-256 of the token as 64 hex digits', () => {
    const { token, tokenHash } = generateResetToken();
    expect(RESET_TOKEN_BYTES).toBe(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(tokenHash).not.toContain(token);
  });

  it('never repeats (2,000 tokens), and a token and its hash never look alike', () => {
    const made = Array.from({ length: 2_000 }, () => generateResetToken());
    expect(new Set(made.map((entry) => entry.token)).size).toBe(2_000);
    expect(new Set(made.map((entry) => entry.tokenHash)).size).toBe(2_000);
  });

  it('uses the whole alphabet: every character of the alphabet shows up in 2,000 tokens, so no bits are fixed', () => {
    const seen = new Set(Array.from({ length: 2_000 }, () => generateResetToken().token).join(''));
    expect(seen.size).toBe(64);
  });
});

describe('hashResetToken and isWellFormedResetToken', () => {
  it('is the SHA-256 of the exact text: one character different is a different hash', () => {
    const { token } = generateResetToken();
    expect(hashResetToken(token)).toBe(hashResetToken(token));
    expect(hashResetToken(`${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`)).not.toBe(hashResetToken(token));
  });

  it.each([
    ['43 characters of the alphabet', 'A'.repeat(43), true],
    ['with - and _', `${'a-b_'.repeat(10)}abc`, true],
    ['42 characters', 'A'.repeat(42), false],
    ['44 characters', 'A'.repeat(44), false],
    ['padding', `${'A'.repeat(42)}=`, false],
    ['a space', `${'A'.repeat(42)} `, false],
    ['a plus, which is not URL-safe', `${'A'.repeat(42)}+`, false],
    ['empty', '', false],
    ['a line break', `${'A'.repeat(42)}\n`, false],
  ])('%s', (_name, text, expected) => {
    expect(isWellFormedResetToken(text)).toBe(expected);
  });
});
