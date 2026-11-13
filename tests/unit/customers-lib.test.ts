import { describe, expect, it } from 'vitest';

import {
  canonicalCustomerName,
  changedContactFields,
  contactValue,
  customerFormProblems,
  detailChangesFrom,
  differCount,
  differsFromDefault,
  emailProblem,
  rateProblem,
  rateText,
  type CustomerRate,
} from '@/lib/masters/customers';
import {
  changedRateInputs,
  customerEditChanges,
  customerEditProblems,
  editFieldOrder,
  initialRateInputs,
  rateErrorKey,
  serverEditErrors,
  typedDiffers,
} from '@/lib/masters/customer-form';
import type { CustomerRow } from '@/lib/masters/customers-client';

/**
 * STORY-02.02 T2, T5 (AC-1, AC-2): the pure rules the Customers screens and routes share: the words of the refusals, the e-mail check, the check of a
 * rate against its unit (up to 2 decimals for every rate, a percent rate included), what really changes in a save, and the page's map of messages. Every value is invented.
 */

const CUTTING: CustomerRate = { processItemId: '00000000-0000-4000-8000-000400000001', name: 'Cutting-Rate-per-Sec', unit: 'per second', defaultValue: '1.37', value: '1.37' };
const OH_PROFIT: CustomerRate = { processItemId: '00000000-0000-4000-8000-000400000013', name: 'OH Profit %', unit: '%', defaultValue: '11.00', value: '11.00' };
const CUSTOMER: CustomerRow = { id: 'c1', name: 'Invented Works', phone: '+99 555 0142', email: null, address: null, rates: [CUTTING, OH_PROFIT] };
const VALUES = { name: 'Invented Works', phone: '+99 555 0142', email: '', address: '' };

describe('the details (AC-1)', () => {
  it('asks for the name in the words of the ux-spec, and refuses one over 100 characters', () => {
    expect(customerFormProblems({ ...VALUES, name: '   ' })).toEqual({ name: 'Enter the customer name.' });
    expect(customerFormProblems({ ...VALUES, name: 'x'.repeat(101) })).toEqual({ name: 'Use 100 characters or fewer.' });
    expect(customerFormProblems(VALUES)).toEqual({});
  });

  it.each(['name@company.com', 'a.b+c@sub.company.co.in', ' name@company.com '])('accepts the e-mail address %j', (email) => {
    expect(emailProblem(email)).toBeNull();
  });

  it.each(['name', 'name@', '@company.com', 'name@company', 'na me@company.com', 'name@@company.com', 'name@company..com', 'name@.com'])(
    'refuses the e-mail address %j in the words of AC-1',
    (email) => {
      expect(emailProblem(email)).toBe('Enter an e-mail address like name@company.com.');
    },
  );

  it('does not ask for the optional fields: an empty phone, e-mail address or address is fine', () => {
    expect(customerFormProblems({ name: 'Invented Works', phone: '', email: '  ', address: '' })).toEqual({});
  });

  it('keeps a name in one canonical form: full-width letters folded, spaces trimmed and collapsed; and a contact field as null when it is empty', () => {
    expect(canonicalCustomerName('  Ｉｎｖｅｎｔｅｄ   Works ')).toBe('Invented Works');
    expect(contactValue('  ')).toBeNull();
    expect(contactValue(undefined)).toBeNull();
    expect(contactValue(' +99 555 0142 ')).toBe('+99 555 0142');
  });
});

describe('what a save really changes (AC-2, AC-6)', () => {
  it('is nothing for the same values: spaces and an empty string for a missing contact field do not count', () => {
    expect(detailChangesFrom(CUSTOMER, { name: ' Invented  Works ', phone: '+99 555 0142', email: '', address: '  ' })).toEqual({});
  });

  it('is only the fields that differ; a contact field cleared is null; a change of letter case counts', () => {
    expect(detailChangesFrom(CUSTOMER, { name: 'INVENTED WORKS', phone: '', email: 'a@b.co' })).toEqual({ name: 'INVENTED WORKS', phone: null, email: 'a@b.co' });
  });

  it('names the contact fields that changed, in the order of the form, and not the name', () => {
    expect(changedContactFields({ name: 'X', address: 'a', phone: null })).toEqual(['phone', 'address']);
  });
});

describe('a rate (AC-2)', () => {
  it.each(['0', '0.5', '12.34', '007.50', ' 3 '])('accepts %j on a rate in rupees', (value) => {
    expect(rateProblem(value)).toBeNull();
  });

  it.each(['', '-1', '1.234', '1,5', 'abc', '1e3', '.5', '1.'])('refuses %j on a rate in rupees in the words of AC-2', (value) => {
    expect(rateProblem(value)).toBe('Enter a number, 0 or more, with up to 2 decimals.');
  });

  it.each(['0', '11', ' 12 ', '12.5', '12.55', '007.50'])('accepts %j on a percent rate: like every other rate, up to 2 decimals (AC-2 as amended, SPEC D-24)', (value) => {
    expect(rateProblem(value)).toBeNull();
  });

  it.each(['', '12.555', '-1', 'x', '12.'])('refuses %j on a percent rate in the words of AC-2 (a number with up to 2 decimals)', (value) => {
    expect(rateProblem(value)).toBe('Enter a number, 0 or more, with up to 2 decimals.');
  });

  it('compares values as stored text, so "11" and "11.00", and "0.5" and "0.50", are one value', () => {
    expect(rateText('0.5')).toBe('0.50');
    expect(differsFromDefault({ defaultValue: '11.00', value: '11' })).toBe(false);
    expect(differsFromDefault({ defaultValue: '1.37', value: '1.38' })).toBe(true);
    expect(differCount([CUTTING, { ...OH_PROFIT, value: '12.00' }])).toBe(1);
  });
});

describe("the edit page's map of messages and changes (AC-1, AC-2, AC-8)", () => {
  const inputs = initialRateInputs(CUSTOMER.rates);

  it('starts from the server\'s values (a percent rate without its trailing .00: "11" for "11.00", "12.50" stays) and lists the controls in the order of the page: the four details, then the rates in table order', () => {
    expect(inputs).toEqual({ [CUTTING.processItemId]: '1.37', [OH_PROFIT.processItemId]: '11' });
    expect(editFieldOrder(CUSTOMER.rates)).toEqual(['name', 'phone', 'email', 'address', rateErrorKey(CUTTING.processItemId), rateErrorKey(OH_PROFIT.processItemId)]);
  });

  it('finds a message for each control that has one, a rate judged against its own unit', () => {
    const problems = customerEditProblems({ ...VALUES, name: '', email: 'x' }, CUSTOMER.rates, { ...inputs, [CUTTING.processItemId]: '1.234', [OH_PROFIT.processItemId]: '11.555' });
    expect(problems).toEqual({
      name: 'Enter the customer name.',
      email: 'Enter an e-mail address like name@company.com.',
      [rateErrorKey(CUTTING.processItemId)]: 'Enter a number, 0 or more, with up to 2 decimals.',
      [rateErrorKey(OH_PROFIT.processItemId)]: 'Enter a number, 0 or more, with up to 2 decimals.',
    });
    expect(customerEditProblems(VALUES, CUSTOMER.rates, inputs)).toEqual({});
  });

  it('does not judge a value again that is the one the customer already has, so a percent rate stored with decimals does not stop a save of something else', () => {
    const odd = { ...OH_PROFIT, value: '11.50', defaultValue: '11.50' };
    const startingInputs = initialRateInputs([odd]);
    expect(startingInputs[odd.processItemId]).toBe('11.50');
    expect(customerEditProblems(VALUES, [odd], startingInputs)).toEqual({});
    expect(customerEditProblems(VALUES, [odd], { [odd.processItemId]: '11.666' })).toEqual({ [rateErrorKey(odd.processItemId)]: 'Enter a number, 0 or more, with up to 2 decimals.' });
    expect(customerEditProblems(VALUES, [odd], { [odd.processItemId]: '' })).toEqual({ [rateErrorKey(odd.processItemId)]: 'Enter a number, 0 or more, with up to 2 decimals.' });
  });

  it('sends nothing for an untouched page, and only what changed otherwise: details as null or text, rates as stored text', () => {
    expect(customerEditChanges(CUSTOMER, VALUES, inputs)).toEqual({});
    expect(customerEditChanges(CUSTOMER, { ...VALUES, phone: '', address: ' 1 Invented Road ' }, { ...inputs, [CUTTING.processItemId]: '2.5', [OH_PROFIT.processItemId]: '11' })).toEqual({
      phone: null,
      address: '1 Invented Road',
      rates: [{ processItemId: CUTTING.processItemId, value: '2.5' }],
    });
    expect(changedRateInputs(CUSTOMER.rates, { ...inputs, [OH_PROFIT.processItemId]: '12' })).toEqual([{ processItemId: OH_PROFIT.processItemId, value: '12' }]);
  });

  it('turns the server\'s messages into the page\'s keys: a detail by name, rates.<index>.value as the rate that was at that index of what was sent', () => {
    const sent = [{ processItemId: OH_PROFIT.processItemId, value: '11.555' }];
    expect(serverEditErrors({ name: 'A customer with this name already exists.', 'rates.0.value': 'Enter a number, 0 or more, with up to 2 decimals.', 'rates.5.value': 'stray', other: 'x' }, sent)).toEqual({
      name: 'A customer with this name already exists.',
      [rateErrorKey(OH_PROFIT.processItemId)]: 'Enter a number, 0 or more, with up to 2 decimals.',
    });
  });

  it('shows the tag from what is typed when it is a number, and from the server\'s value while it is not', () => {
    expect(typedDiffers(CUTTING, '2.00')).toBe(true);
    expect(typedDiffers(CUTTING, '1.370')).toBe(false);
    expect(typedDiffers({ ...CUTTING, value: '2.00' }, 'abc')).toBe(true);
    expect(typedDiffers(CUTTING, undefined)).toBe(false);
  });
});
