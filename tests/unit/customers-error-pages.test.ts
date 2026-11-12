import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import CustomersError from '../../src/app/(portal)/masters/customers/error';
import CustomerPageError from '../../src/app/(portal)/masters/customers/[id]/error';

/**
 * SCR-12 "Error" (ux-spec v0.24, "The Customers words: final words", test 5): the list and the customer's page each have their own error boundary and
 * their own title, with the standard sentence under it; and the `?added=1` notice, which no flow sets, is gone (QLT-03, AQP-142 G6).
 */

const MASTERS = join(__dirname, '..', '..', 'src', 'components', 'features', 'masters');
const props = { error: new Error('invented failure'), reset: () => undefined };

describe('the load error of SCR-12 (ux-spec v0.24)', () => {
  it("the customer's page says We could not load this customer, with the standard sentence and a Try again button, under the Customers header", () => {
    const html = renderToStaticMarkup(createElement(CustomerPageError, props));
    expect(html).toContain('We could not load this customer');
    expect(html).toContain('Check your connection and try again. Nothing was changed.');
    expect(html).toContain('Try again');
    expect(html).toContain('Customers');
    expect(html).not.toContain('We could not load customers');
  });

  it('the list keeps its own title and the same sentence', () => {
    const html = renderToStaticMarkup(createElement(CustomersError, props));
    expect(html).toContain('We could not load customers');
    expect(html).toContain('Check your connection and try again. Nothing was changed.');
    expect(html).not.toContain('We could not load this customer');
  });
});

describe('the Added notice that no flow sets (QLT-03)', () => {
  it('no customer file reads or mentions ?added=1, useSearchParams or customerCreatedNotice', () => {
    const files = readdirSync(MASTERS).filter((file) => /^(customer-.*\.tsx?|use-customers\.ts|use-customer-edit\.ts)$/.test(file));
    expect(files.length).toBeGreaterThan(5);
    for (const file of files) {
      const source = readFileSync(join(MASTERS, file), 'utf8');
      expect(source, file).not.toMatch(/added=1|useSearchParams|customerCreatedNotice/);
    }
  });
});
