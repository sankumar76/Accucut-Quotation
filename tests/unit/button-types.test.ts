import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import { Button, buttonVariants } from '@/components/ui/button';

/**
 * G6 QLT-09: `asChild` renders the child (a link) with the button's look, so it can not show a spinner or be
 * disabled. The type refuses those props together, instead of dropping them without a sign. The `@ts-expect-error`
 * lines are checked by `tsc --noEmit` (CI stage 5): if the type were loosened, the line would no longer be an error
 * and the type-check would fail.
 */

describe('Button props', () => {
  it('QLT-09: accepts a button with loading or disabled, and a link look without them', () => {
    expect(createElement(Button, { loading: true }, 'Approving').props).toMatchObject({ loading: true });
    expect(createElement(Button, { disabled: true }, 'Approve').props).toMatchObject({ disabled: true });
    expect(createElement(Button, { asChild: true }, createElement('a', { href: '/' }, 'Home')).props).toMatchObject({ asChild: true });
  });

  it('QLT-09: refuses asChild together with loading, and asChild together with disabled', () => {
    // @ts-expect-error asChild with loading: a link can not show a spinner or set aria-busy
    const withLoading = createElement(Button, { asChild: true, loading: true }, createElement('a', { href: '/' }, 'Home'));
    // @ts-expect-error asChild with disabled: a link would stay clickable while looking enabled
    const withDisabled = createElement(Button, { asChild: true, disabled: true }, createElement('a', { href: '/' }, 'Home'));
    expect(withLoading.type).toBe(Button);
    expect(withDisabled.type).toBe(Button);
  });
});

describe('buttonVariants (QLT-01)', () => {
  it('the secondary variant carries its own border colour after the base border-transparent', () => {
    const classes = buttonVariants({ variant: 'secondary' }).split(' ');
    expect(classes.indexOf('border-border-strong')).toBeGreaterThan(classes.indexOf('border-transparent'));
  });

  it('every variant and size is defined', () => {
    for (const variant of ['primary', 'secondary', 'ghost', 'danger'] as const) {
      expect(buttonVariants({ variant })).toContain('h-(--control-h)');
    }
    expect(buttonVariants({ size: 'icon-row' })).toContain('h-(--control-h-row)');
  });
});
