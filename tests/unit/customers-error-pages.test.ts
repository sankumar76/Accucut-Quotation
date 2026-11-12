import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import CustomersError from '../../src/app/(portal)/masters/customers/error';
import CustomerPageError from '../../src/app/(portal)/masters/customers/[id]/error';

/**
 * SCR-12 "Error" (ux-spec v0.24 and v0.26): the list and the customer's page each have their own error boundary and their own title; the list has the
 * standard sentence under it, and the page one that does not claim nothing was changed (the read can fail after a save). The `?added=1` notice, which
 * no flow sets, is gone (QLT-03, AQP-142 G6).
 */

const MASTERS = join(__dirname, '..', '..', 'src', 'components', 'features', 'masters');
const props = { error: new Error('invented failure'), reset: () => undefined };

describe('the load error of SCR-12 (ux-spec v0.24 and v0.26)', () => {
  it("the customer's page says We could not load this customer, with the sentence that its last change was kept, a Try again button, under the Customers header", () => {
    const html = renderToStaticMarkup(createElement(CustomerPageError, props));
    expect(html).toContain('We could not load this customer');
    expect(html).toContain('Check your connection and try again. If you just saved or reset this customer, that change was kept.');
    expect(html).toContain('Try again');
    expect(html).toContain('Customers');
    expect(html).not.toContain('We could not load customers');
  });

  it("the customer's page never says Nothing was changed: the read can fail after a save or a reset that went through (v0.26, test 6)", () => {
    expect(renderToStaticMarkup(createElement(CustomerPageError, props))).not.toContain('Nothing was changed');
  });

  it('the list keeps its own title and the standard sentence, which is true of a read', () => {
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
