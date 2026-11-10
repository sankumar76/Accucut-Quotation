import { describe, expect, it } from 'vitest';

import { isUserRole, nameProblem, newPasswordProblem, PASSWORD_MAX_LENGTH, USER_EMAIL_MAX_LENGTH, USER_NAME_MAX_LENGTH, userEmailProblem } from '@/lib/users/validation';

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

describe('newPasswordProblem', () => {
  it('needs a password, keeps spaces as part of it and caps its length (the rule itself is story 01.05)', () => {
    expect(newPasswordProblem('')).toBe('Enter a password.');
    expect(newPasswordProblem('   ')).toBeNull();
    expect(newPasswordProblem('x'.repeat(PASSWORD_MAX_LENGTH))).toBeNull();
    expect(newPasswordProblem('x'.repeat(PASSWORD_MAX_LENGTH + 1))).toBe(`Use ${PASSWORD_MAX_LENGTH} characters or fewer.`);
  });
});

describe('isUserRole', () => {
  it('knows the three roles and nothing else', () => {
    expect(['ADMIN', 'LEAD', 'ENGINEER'].every(isUserRole)).toBe(true);
    expect(['admin', 'OWNER', ''].some(isUserRole)).toBe(false);
  });
});
