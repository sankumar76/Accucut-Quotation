import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { UnitInput } from '@/components/shared/unit-input';

/**
 * AQP-482 (DEF-125; master's DL-420): the unit of a number input is read as its **description**, not as part of its name (a name that is not the visible label fails WCAG 2.5.3; the unit is not the label). The input is
 * described by the add-on beside it, after anything it was already described by (a hint, an error); the add-on's `id` is made from the input's. An input with no `id` has no such link. Every name is invented.
 */

const html = (props: Record<string, unknown>): string => renderToStaticMarkup(createElement(UnitInput, { unit: 'mm', ...props }));
const inputOf = (markup: string): string => /<input[^>]*>/.exec(markup)?.[0] ?? '';
const describedBy = (markup: string): string[] => (/aria-describedby="([^"]*)"/.exec(inputOf(markup))?.[1] ?? '').split(' ').filter((id) => id !== '');

describe('UnitInput', () => {
  it('describes the input by the add-on, which carries that id and the unit', () => {
    const markup = html({ id: 'field-length' });
    expect(describedBy(markup)).toEqual(['field-length-unit']);
    expect(markup).toMatch(/<span[^>]*id="field-length-unit"[^>]*>mm<\/span>/);
  });

  it('keeps what the input was already described by, first, and adds the unit after it', () => {
    expect(describedBy(html({ id: 'field-length', 'aria-describedby': 'field-length-hint field-length-error' }))).toEqual(['field-length-hint', 'field-length-error', 'field-length-unit']);
  });

  it('does not put the unit in the input\'s name: the add-on is not a label of the input', () => {
    const input = inputOf(html({ id: 'field-length', 'aria-label': 'Length' }));
    expect(input).not.toContain('aria-labelledby');
    expect(input).toContain('aria-label="Length"');
  });

  it('has no link, and no id on the add-on, for an input with no id, and passes aria-describedby through as it came', () => {
    expect(describedBy(html({}))).toEqual([]);
    expect(describedBy(html({ 'aria-describedby': 'hint-1' }))).toEqual(['hint-1']);
    expect(html({})).not.toMatch(/<span[^>]*\sid=/);
  });
});
