import { describe, expect, it } from 'vitest';

import { isCommonPassword } from '@/lib/auth/common-passwords';
import {
  checkPasswordRule,
  passwordLength,
  passwordRuleMessage,
  passwordRuleProblem,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_RULE_HINT,
  type PasswordRuleContext,
  type PasswordRuleFailure,
} from '@/lib/auth/password-rule';

/**
 * STORY-01.05 AC-1 and AC-2 (FR-098, BR-049; SPEC section 12; test strategy section 7 "Password rule"). The rule is a pure function, so
 * the case table of the story is run against it as it is: the server's form (with the list of common passwords) and the page's form
 * (without it). Every name, address and password here is invented. 100 percent of the branches of `password-rule.ts` are covered.
 */

const EMAIL = 'Rohan.Das7@Example.TEST';
const SERVER: PasswordRuleContext = { email: EMAIL, subject: 'self', isCommon: isCommonPassword };

/** A password of exactly `length` characters that has a letter, a number and a symbol. */
function passwordOfLength(length: number): string {
  return `Qx7!${'k'.repeat(length - 4)}`;
}

describe('AC-1: the case table of the story (the server form)', () => {
  const cases: ReadonlyArray<readonly [string, string, PasswordRuleFailure | null]> = [
    ['9 characters', passwordOfLength(9), 'TOO_SHORT'],
    ['10 characters', passwordOfLength(10), null],
    ['128 characters', passwordOfLength(128), null],
    ['129 characters', passwordOfLength(129), 'TOO_LONG'],
    ['no number', 'Qx!kkkkkkkk', 'NO_NUMBER'],
    ['no symbol', 'Qx7kkkkkkkk', 'NO_SYMBOL'],
    ['neither a number nor a symbol', 'Qxkkkkkkkkk', 'NO_NUMBER_OR_SYMBOL'],
    ['a space as the only symbol', 'Qx7 kkkkkkk', null],
    ['the e-mail address in other letter case', 'rohan.das7@example.test', 'SAME_AS_EMAIL'],
    ['the e-mail address in capitals', 'ROHAN.DAS7@EXAMPLE.TEST', 'SAME_AS_EMAIL'],
    ['Password1! (common after the ends are stripped)', 'Password1!', 'TOO_COMMON'],
    ['Welcome@123 (common after the ends are stripped)', 'Welcome@123', 'TOO_COMMON'],
    ['a word with the product name', 'my-Accucut-pass-9', 'TOO_COMMON'],
    ['one valid password', 'Tn4#vLm8@Qz', null],
  ];

  it.each(cases)('%s', (_name, password, expected) => {
    expect(checkPasswordRule(password, SERVER)).toBe(expected);
  });

  it('counts the length in code points and checks it first', () => {
    expect(passwordLength('😀😀😀😀😀😀😀😀😀😀')).toBe(10);
    // Ten emoji are 20 UTF-16 units but 10 characters, and a symbol each: they pass the length, and fail only for want of a number.
    expect(checkPasswordRule('😀😀😀😀😀😀😀😀😀😀', SERVER)).toBe('NO_NUMBER');
    // 128 emoji and a number are 129 characters.
    expect(checkPasswordRule(`${'😀'.repeat(128)}7`, SERVER)).toBe('TOO_LONG');
    expect(checkPasswordRule(`${'😀'.repeat(127)}7`, SERVER)).toBeNull();
  });

  it('puts the length before every other part', () => {
    expect(checkPasswordRule('abc', { ...SERVER, email: 'abc' })).toBe('TOO_SHORT');
    expect(checkPasswordRule('Welcome', SERVER)).toBe('TOO_SHORT');
  });

  it('ignores the spaces around the e-mail address it is compared with', () => {
    expect(checkPasswordRule('rohan.das7@example.test', { ...SERVER, email: `  ${EMAIL}  ` })).toBe('SAME_AS_EMAIL');
  });

  it('does not trim the password: spaces may be part of it', () => {
    expect(checkPasswordRule(' rohan.das7@example.test ', SERVER)).toBeNull();
  });

  it('takes a letter of any alphabet as a letter and not as a symbol', () => {
    // "ñ", "ß", "ж" and "字" are letters; with a number and no other symbol the password still needs a symbol.
    expect(checkPasswordRule('ñßжжжжжжжж9', SERVER)).toBe('NO_SYMBOL');
    expect(checkPasswordRule('ñßжжжжжжжж字', SERVER)).toBe('NO_NUMBER_OR_SYMBOL');
  });

  it('takes any character that is neither a letter nor a digit as a symbol', () => {
    for (const symbol of [' ', '!', '#', '$', '%', '_', '-', '~', '€', '😀']) {
      expect(checkPasswordRule(`Qx7${symbol}kkkkkkk`, SERVER), JSON.stringify(symbol)).toBeNull();
    }
  });
});

describe('the page form: the same rule without the list of common passwords', () => {
  const page: PasswordRuleContext = { email: EMAIL, subject: 'other' };

  it('does not name a common password, which the server names (UX spec section 6.0)', () => {
    expect(checkPasswordRule('Password1!', page)).toBeNull();
    expect(checkPasswordRule('Welcome@123', page)).toBeNull();
  });

  it('still names every other part', () => {
    expect(checkPasswordRule('Qx7!kkk', page)).toBe('TOO_SHORT');
    expect(checkPasswordRule(passwordOfLength(129), page)).toBe('TOO_LONG');
    expect(checkPasswordRule('rohan.das7@example.test', page)).toBe('SAME_AS_EMAIL');
    expect(checkPasswordRule('Qxkkkkkkkkk', page)).toBe('NO_NUMBER_OR_SYMBOL');
  });
});

describe('AC-2: the words of the screen (UX spec section 6.0 "Password messages")', () => {
  const words: ReadonlyArray<readonly [PasswordRuleFailure, string]> = [
    ['TOO_SHORT', 'The new password must be at least 10 characters.'],
    ['TOO_LONG', 'Use 128 characters or fewer.'],
    ['NO_NUMBER_OR_SYMBOL', 'Add at least one number and one symbol, such as ! # $ or %.'],
    ['NO_NUMBER', 'Add at least one number.'],
    ['NO_SYMBOL', 'Add at least one symbol, such as ! # $ or %.'],
    ['SAME_AS_EMAIL', 'The password cannot be the same as your e-mail address.'],
    ['TOO_COMMON', 'That password is too common. Choose a different one.'],
  ];

  it.each(words)('%s reads exactly as the spec says', (failure, message) => {
    expect(passwordRuleMessage(failure, 'self')).toBe(message);
  });

  it("says \"the user's e-mail address\" on the Admin's screens", () => {
    expect(passwordRuleMessage('SAME_AS_EMAIL', 'other')).toBe("The password cannot be the same as the user's e-mail address.");
    expect(passwordRuleMessage('TOO_COMMON', 'other')).toBe('That password is too common. Choose a different one.');
  });

  it('gives the message of the first failing part, or null for a password that passes', () => {
    expect(passwordRuleProblem('Qx7!kkk', SERVER)).toBe('The new password must be at least 10 characters.');
    expect(passwordRuleProblem('rohan.das7@example.test', { ...SERVER, subject: 'other' })).toBe(
      "The password cannot be the same as the user's e-mail address.",
    );
    expect(passwordRuleProblem('Tn4#vLm8@Qz', SERVER)).toBeNull();
  });

  it('states the limits and the hint of the spec', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(10);
    expect(PASSWORD_MAX_LENGTH).toBe(128);
    expect(PASSWORD_RULE_HINT).toBe('At least 10 and at most 128 characters, with at least one number and one symbol, such as ! # $ or %.');
  });
});

describe('the list of common passwords', () => {
  it.each(['password', 'Password1!', 'WELCOME@123', '123Qwerty!!', 'letmein2024#'])('refuses %s', (password) => {
    expect(isCommonPassword(password)).toBe(true);
  });

  it('refuses a product word anywhere in the password', () => {
    expect(isCommonPassword('Accucut@2026!')).toBe(true);
    expect(isCommonPassword('x9-ACCUCUT-lasers')).toBe(true);
    expect(isCommonPassword('Quotation#42Zy')).toBe(true);
  });

  it('accepts a password that is not a common word once its ends are stripped', () => {
    expect(isCommonPassword('Tn4#vLm8@Qz')).toBe(false);
    // Only the ends are stripped: a symbol inside the word keeps it from matching the list.
    expect(isCommonPassword('pass#word')).toBe(false);
    expect(isCommonPassword('!!!!!!!!!1')).toBe(false);
  });
});
