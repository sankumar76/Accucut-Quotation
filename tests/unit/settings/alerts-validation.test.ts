import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  isValidSenderAddress,
  SENDER_ADDRESS_COMMA,
  SENDER_ADDRESS_INVALID,
  SENDER_ADDRESS_LINE_BREAK,
  SENDER_ADDRESS_MAX_LENGTH,
  SENDER_ADDRESS_REQUIRED,
  SENDER_ADDRESS_TOO_LONG,
  SENDER_NAME_LINE_BREAK,
  SENDER_NAME_MAX_LENGTH,
  SENDER_NAME_REQUIRED,
  SENDER_NAME_TOO_LONG,
  senderProblems,
  trimmedSender,
} from '@/lib/settings/validation';

/**
 * STORY-09.02 AC-3: the rules for the sender name and address, shared by the form and the server. Every address is invented (example.com).
 */

const valid = { alertsEnabled: true, senderName: 'Accucut Portal', senderAddress: 'portal@example.com' } as const;

describe('AC-3: sender name', () => {
  it('accepts 1 and 100 characters', () => {
    expect(senderProblems({ ...valid, senderName: 'A' })).toEqual({});
    expect(senderProblems({ ...valid, senderName: 'A'.repeat(SENDER_NAME_MAX_LENGTH) })).toEqual({});
  });

  it('refuses an empty or blank name, and one of 101 characters', () => {
    expect(senderProblems({ ...valid, senderName: '' })).toEqual({ senderName: SENDER_NAME_REQUIRED });
    expect(senderProblems({ ...valid, senderName: '   ' })).toEqual({ senderName: SENDER_NAME_REQUIRED });
    expect(senderProblems({ ...valid, senderName: 'A'.repeat(SENDER_NAME_MAX_LENGTH + 1) })).toEqual({ senderName: SENDER_NAME_TOO_LONG });
  });

  it('counts the name without the space at its ends', () => {
    expect(senderProblems({ ...valid, senderName: ` ${'A'.repeat(SENDER_NAME_MAX_LENGTH)} ` })).toEqual({});
  });

  it.each(['Portal\nBcc: someone@example.com', 'Portal\r\n', `Portal${String.fromCharCode(0x2028)}x`, '\nPortal'])('refuses a line break in the name: %j (header injection)', (name) => {
    expect(senderProblems({ ...valid, senderName: name })).toEqual({ senderName: SENDER_NAME_LINE_BREAK });
  });
});

describe('AC-3: sender address', () => {
  it('accepts a valid address and one of exactly 254 characters', () => {
    expect(senderProblems(valid)).toEqual({});
    const local = 'a'.repeat(64);
    const domain = `${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(57)}.com`;
    const longest = `${local}@${domain}`;
    expect(longest).toHaveLength(SENDER_ADDRESS_MAX_LENGTH);
    expect(senderProblems({ ...valid, senderAddress: longest })).toEqual({});
  });

  it('refuses 255 characters', () => {
    const address = `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(58)}.com`;
    expect(address).toHaveLength(SENDER_ADDRESS_MAX_LENGTH + 1);
    expect(senderProblems({ ...valid, senderAddress: address })).toEqual({ senderAddress: SENDER_ADDRESS_TOO_LONG });
  });

  it.each(['portal', 'portal@', '@example.com', 'portal@example', 'two words@example.com', 'a..b@example.com'])('refuses %j as not an address', (address) => {
    expect(senderProblems({ ...valid, senderAddress: address })).toEqual({ senderAddress: SENDER_ADDRESS_INVALID });
  });

  it.each(['a@example.com,b@example.com', 'a@example.com, b@example.com', ',a@example.com'])('refuses a comma: %j (a second recipient)', (address) => {
    expect(senderProblems({ ...valid, senderAddress: address })).toEqual({ senderAddress: SENDER_ADDRESS_COMMA });
  });

  it.each(['a@example.com\nBcc: b@example.com', 'a@example.com\r\n', '\na@example.com'])('refuses a line break: %j (header injection)', (address) => {
    expect(senderProblems({ ...valid, senderAddress: address })).toEqual({ senderAddress: SENDER_ADDRESS_LINE_BREAK });
  });

  it('turning alerts ON with no address is refused; with alerts OFF an empty address is allowed', () => {
    expect(senderProblems({ ...valid, senderAddress: '' })).toEqual({ senderAddress: SENDER_ADDRESS_REQUIRED });
    expect(senderProblems({ ...valid, senderAddress: '   ' })).toEqual({ senderAddress: SENDER_ADDRESS_REQUIRED });
    expect(senderProblems({ alertsEnabled: false, senderName: 'Accucut Portal', senderAddress: '' })).toEqual({});
  });

  it('an address that is wrong is refused with alerts OFF too', () => {
    expect(senderProblems({ alertsEnabled: false, senderName: 'Accucut Portal', senderAddress: 'nope' })).toEqual({ senderAddress: SENDER_ADDRESS_INVALID });
  });
});

describe('AC-3: all problems at once, one message per field', () => {
  it('names both fields together', () => {
    expect(senderProblems({ alertsEnabled: true, senderName: '', senderAddress: 'nope' })).toEqual({ senderName: SENDER_NAME_REQUIRED, senderAddress: SENDER_ADDRESS_INVALID });
  });
});

describe('trimmedSender', () => {
  it('removes the space at both ends of the name and the address and keeps the switch', () => {
    expect(trimmedSender({ alertsEnabled: false, senderName: '  Portal ', senderAddress: ' portal@example.com  ' })).toEqual({
      alertsEnabled: false,
      senderName: 'Portal',
      senderAddress: 'portal@example.com',
    });
  });
});

describe('the address rule is the rule of the mailer (zod z.email)', () => {
  const samples = [
    'portal@example.com',
    'first.last@sub.example.com',
    "o'brien+tag@sub.example.org",
    'a@b.co',
    'a..b@example.com',
    '.a@example.com',
    'a@example',
    'a@-b.example.com',
    'a b@example.com',
    'a@example..com',
    'a@exa_mple.com',
    'name@example.c',
    'x@123.45',
  ];
  it.each(samples)('%j is judged as z.email() judges it', (sample) => {
    expect(isValidSenderAddress(sample)).toBe(z.email().safeParse(sample).success);
  });
});
