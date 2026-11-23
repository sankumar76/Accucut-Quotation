import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { AssignScreen } from '@/components/features/tasks/assign-screen';
import { ASSIGN_FIELD_IDS, ASSIGN_SHORT_NAME_ID, EMPTY_ASSIGN_VALUES, errorFieldOf, inputOf, serverAssignErrors } from '@/components/features/tasks/assign-form-model';
import { NEXT_STEPS, SUBJECT_HINT, TITLE_HINT } from '@/components/features/tasks/assign-texts';
import { ReadOnlyField } from '@/components/shared/read-only-field';
import { ASSIGN_FIELD_NAMES, SUBJECT_MAX_LENGTH, TITLE_MAX_LENGTH } from '@/lib/tasks/assign';

/**
 * CR-01 item 6 (AQP-390, AC-1 to AC-4, AC-18): SCR-04 "Assign task" drawn on the server the way the first paint is, and the model behind it. The customer is a required select of the customers
 * that are not deleted, the short name is a read-only output with its label (never an input, never sent), the subject and the title are required, and the notes are the only optional field. What
 * a browser does with them (choosing, the error summary, the focus) is `tests/e2e/assign-task.spec.ts`. Every name is invented.
 */

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }), usePathname: () => '/assign' }));

const ENGINEERS = [{ id: '00000000-0000-4000-8000-0000000000e1', name: 'Invented Arjun' }];
const CUSTOMERS = [
  { id: '00000000-0000-4000-8000-0000000000c1', name: 'Brightwater Controls', shortName: 'BWC' },
  { id: '00000000-0000-4000-8000-0000000000c2', name: 'Marlow Agro Systems', shortName: 'MAS' },
];

const draw = (customers: ReadonlyArray<(typeof CUSTOMERS)[number]> = CUSTOMERS): string =>
  renderToStaticMarkup(createElement(AssignScreen, { engineers: ENGINEERS, customers, alertsEnabled: false }));

describe('AC-1: Customer Name is a required select of the customers, by name', () => {
  it('has a visible label, a placeholder first, and one option per customer that is given, with the ID as its value and the name as its text', () => {
    const html = draw();
    expect(html).toContain('Customer Name');
    expect(html).toMatch(/<select[^>]*id="assign-customer"[^>]*required=""/);
    expect(html).toContain('>Choose the customer</option>');
    for (const customer of CUSTOMERS) expect(html).toContain(`<option value="${customer.id}">${customer.name}</option>`);
  });

  it('puts only the customer\'s name in the option, never its short name or any other field of the master', () => {
    const html = draw();
    const select = /<select[^>]*id="assign-customer"[\s\S]*?<\/select>/.exec(html)?.[0] ?? '';
    expect(select).not.toContain('BWC');
    expect(select).not.toContain('MAS');
  });

  it('says there is no customer to choose, and who to ask, when the Customer master has none', () => {
    expect(draw([])).toContain('There is no customer to choose. Ask the Admin to add one.');
  });
});

describe('AC-2: Customer Short Name is a read-only output with its label, empty until a customer is chosen', () => {
  it('is an output tied to its visible label, not an input of any kind, and empty on first paint', () => {
    const html = draw();
    expect(html).toMatch(/<label[^>]*for="assign-short-name"[^>]*>Customer Short Name<\/label>/);
    expect(html).toMatch(/<output[^>]*id="assign-short-name"[^>]*><\/output>/);
    expect(html).not.toMatch(/<input[^>]*(name="shortName"|id="assign-short-name")/);
    expect(html).not.toContain('disabled=""><');
  });

  it('is not part of what the form sends: the request has no key for it', () => {
    expect(Object.keys(inputOf(EMPTY_ASSIGN_VALUES)).sort()).toEqual(['customerId', 'deadline', 'engineerId', 'folderPath', 'notes', 'subject', 'title']);
    expect(Object.keys(EMPTY_ASSIGN_VALUES)).not.toContain('shortName');
    expect(ASSIGN_FIELD_NAMES).not.toContain('shortName');
  });

  it('the shared ReadOnlyField is a labelled output that keeps its hint as its description, and shows the value it is given', () => {
    const html = renderToStaticMarkup(createElement(ReadOnlyField, { id: 'x-field', label: 'A label', hint: 'A hint', mono: true }, 'BWC'));
    expect(html).toMatch(/<label[^>]*for="x-field"[^>]*>A label<\/label>/);
    expect(html).toMatch(/<output[^>]*id="x-field"[^>]*aria-describedby="x-field-hint"[^>]*>BWC<\/output>/);
    expect(html).toContain('id="x-field-hint"');
    expect(html).toContain('font-mono');
  });
});

describe('AC-3, AC-4: the subject and the title are required, the notes are not', () => {
  it('draws Subject (project name) and Title as required inputs with their hints from the constants, and only Notes carries the (optional) tag', () => {
    const html = draw();
    expect(html).toMatch(/<input[^>]*id="assign-subject"[^>]*required=""/);
    expect(html).toMatch(/<input[^>]*id="assign-title"[^>]*required=""/);
    expect(html).toContain('Subject (project name)');
    expect(SUBJECT_HINT).toBe(`Up to ${SUBJECT_MAX_LENGTH} characters. The project name.`);
    expect(TITLE_HINT).toBe(`Up to ${TITLE_MAX_LENGTH} characters. Shown in the queue next to the task ID.`);
    expect(html).toContain(SUBJECT_HINT);
    expect(html).toContain(TITLE_HINT);
    expect(html.split('(optional)').length - 1).toBe(1);
    expect(html).toMatch(/Notes[\s\S]{0,80}\(optional\)/);
  });

  it('lists the fields in the order of the page, so the summary and the first focus follow it', () => {
    const html = draw();
    const order = ['assign-engineer', 'assign-customer', 'assign-short-name', 'assign-path', 'assign-date', 'assign-title', 'assign-subject', 'assign-notes'].map((id) => html.indexOf(`id="${id}"`));
    expect(order.every((place) => place > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(Object.keys(ASSIGN_FIELD_IDS)).toEqual(['engineerId', 'customerId', 'folderPath', 'deadline', 'title', 'subject', 'notes']);
  });
});

describe('the words of "What happens next" and the model', () => {
  it('says the Engineer sees the customer and the subject and cannot change them, and no longer says the Engineer chooses the customer', () => {
    expect(NEXT_STEPS.join(' ')).toContain('cannot change them');
    expect(NEXT_STEPS.join(' ')).not.toContain('chooses the customer');
    expect(draw()).not.toContain('chooses the customer');
  });

  it('writes a customer or a subject message to its own field, and keeps messages for fields the form does not have out', () => {
    expect(errorFieldOf('customerId')).toBe('customerId');
    expect(errorFieldOf('subject')).toBe('subject');
    expect(serverAssignErrors({ customerId: 'Choose a customer.', subject: 'Enter the subject.', shortName: 'no such field' }, ASSIGN_FIELD_NAMES)).toEqual({ customerId: 'Choose a customer.', subject: 'Enter the subject.' });
    expect(ASSIGN_SHORT_NAME_ID).toBe('assign-short-name');
  });
});
