import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { NativeSelect } from '@/components/ui/native-select';

/**
 * AQP-491 (DEF-138; hands-on check 2, N-6): a read-only drop-down is drawn as a read-only box is: a dashed border and the grey fill, with the grey text, so it does not look editable. The look follows
 * `aria-readonly` (which `readOnlySelectProps` sets), the same way `Input` follows `read-only:`. The behaviour (it neither opens nor changes) is judged by `tests/e2e/estimate-review.spec.ts`.
 */
describe('AQP-491: the read-only look of the drop-down', () => {
  const html = renderToStaticMarkup(createElement(NativeSelect, { 'aria-readonly': true, defaultValue: 'a' }, createElement('option', { value: 'a' }, 'A')));

  it('has the dashed border, the grey fill and the grey text of a read-only box, keyed on aria-readonly', () => {
    for (const rule of ['aria-readonly:border-dashed', 'aria-readonly:bg-surface-2', 'aria-readonly:text-ink-2']) expect(html).toContain(rule);
  });

  it('keeps the chevron, because it is still a drop-down, and the select is not disabled', () => {
    expect(html).toContain('<svg');
    expect(html).not.toContain(' disabled=""');
  });
});
