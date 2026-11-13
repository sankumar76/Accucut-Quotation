import { describe, expect, it } from 'vitest';

import { isUserRole, nameProblem, newPasswordProblem, USER_EMAIL_MAX_LENGTH, USER_NAME_MAX_LENGTH, userEmailProblem } from '@/lib/users/validation';

/** STORY-01.04 AC-1: the shape checks of the Users form, with the UX spec's words. The server repeats them. */

describe('nameProblem', () => {
  it('asks for a name, ignoring spaces, and caps its length', () => {
    expect(nameProblem('Rohan Das')).toBeNull();
    expect(nameProblem('   ')).toBe('Enter a name.');
    expect(nameProblem('x'.repeat(USER_NAME_MAX_LENGTH))).toBeNull();
    expect(nameProblem('x'.repeat(USER_NAME_MAX_LENGTH + 1))).toBe(`Use ${USER_NAME_MAX_LENGTH} characters or fewer.`);
  });
});

describe('userEmailProblem', () => {
  it('accepts an address, with spaces round it', () => {
    expect(userEmailProblem(' rohan.das@example.test ')).toBeNull();
  });

  it.each(['', '   ', 'rohan', 'rohan@', '@example.test', 'rohan@example', 'a b@example.test'])('says what an address looks like for "%s"', (value) => {
    expect(userEmailProblem(value)).toBe('Enter an e-mail address like name@company.com.');
  });

  it('refuses an address longer than the standard allows', () => {
    expect(userEmailProblem(`${'a'.repeat(USER_EMAIL_MAX_LENGTH)}@example.test`)).toBe('Enter an e-mail address like name@company.com.');
  });
});

describe('newPasswordProblem (STORY-01.05 AC-2: the parts of the rule that need no list)', () => {
  const EMAIL = 'rohan.das@example.test';

  it('needs a password first, with the message of the empty field', () => {
    expect(newPasswordProblem('', EMAIL)).toBe('Enter a password.');
  });

  it.each([
    ['too short', 'Ab7!xyzuv', 'The new password must be at least 10 characters.'],
    ['too long', `Ab7!${'x'.repeat(125)}`, 'Use 128 characters or fewer.'],
    ['neither a number nor a symbol', 'abcdefghijkl', 'Add at least one number and one symbol, such as ! # $ or %.'],
    ['no number', 'abcdef-ghijkl', 'Add at least one number.'],
    ['no symbol', 'abcdefghijk7', 'Add at least one symbol, such as ! # $ or %.'],
    ['the e-mail address in other letter case', 'ROHAN.DAS@example.test', "The password cannot be the same as the user's e-mail address."],
  ])('names the part for a password that is %s', (_name, password, message) => {
    expect(newPasswordProblem(password, EMAIL)).toBe(message);
  });

  it('keeps spaces as part of the password (a space is the symbol) and leaves the common-password check to the server', () => {
    expect(newPasswordProblem('abc def 7 ghi', EMAIL)).toBeNull();
    expect(newPasswordProblem('Welcome@123', EMAIL)).toBeNull();
  });
});

describe('isUserRole', () => {
  it('knows the three roles and nothing else', () => {
    expect(['ADMIN', 'LEAD', 'ENGINEER'].every(isUserRole)).toBe(true);
    expect(['admin', 'OWNER', ''].some(isUserRole)).toBe(false);
  });
});
