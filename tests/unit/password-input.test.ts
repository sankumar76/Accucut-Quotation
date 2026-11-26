import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { hideWhenLeft, PasswordInput, type PasswordInputProps } from '@/components/shared/password-input';

import { renderHook } from '../support/hook-harness';

// The component is called as a function and the elements it returns are read, as in `add-node-menu-sub-part.test.ts`: no DOM is needed to pin what the control is given and what its handlers do.
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), ...(await import('../support/hook-harness')).reactHooks }));

/**
 * AQP-459 follow-up (DEF-102, minor; the ux-expert's answer of 2026-11-26; DL-419 (E)): the show / hide button of `PasswordInput` is **inside the field**, at its right edge, one control for the ten forms that use it. The
 * checks that DL-419 (E) lists for a control that touches every password form: `autocomplete` kept, the visibility reset on a submit, a navigation and an error, no password in a URL, a log or a fixture (there is none here: the
 * value is the caller's), `type="button"`, `aria-pressed` and the name, the focus, and the browsers' password managers (the input stays one `input` with its `name`, `id` and `autocomplete`). The widths, axe and the
 * forms themselves are `tests/e2e/sign-in.spec.ts` and `account.spec.ts`. Every value is invented.
 */

// The control listens on the page for pagehide when it mounts; the harness runs that effect, and a node test has no window.
const pageListeners = new Map<string, () => void>();
vi.stubGlobal('window', { addEventListener: (type: string, listener: () => void) => pageListeners.set(type, listener), removeEventListener: (type: string) => pageListeners.delete(type) });
// A reset on pagehide must be committed before the page is frozen (SEC-787-01): the control wraps it in `flushSync`, which the test counts.
const flushed = vi.hoisted(() => ({ count: 0 }));
vi.mock('react-dom', () => ({
  flushSync: (work: () => void) => {
    flushed.count += 1;
    work();
  },
}));

type Props = Record<string, unknown>;

function elementsIn(node: ReactNode, found: ReactElement<Props>[] = []): ReactElement<Props>[] {
  if (Array.isArray(node)) {
    for (const child of node) elementsIn(child as ReactNode, found);
  } else if (typeof node === 'object' && node !== null && 'props' in node) {
    const element = node as ReactElement<Props>;
    found.push(element);
    elementsIn(element.props['children'] as ReactNode, found);
  }
  return found;
}

/** One mounted control whose props the test can change between renders, as a form does when a field becomes invalid. */
function mount(initial: Props = {}) {
  let props: Props = { name: 'password', id: 'password', autoComplete: 'current-password', ...initial };
  const hook = renderHook(() => PasswordInput(props as PasswordInputProps), undefined);
  const parts = () => {
    const all = elementsIn(hook.render());
    const input = all.find((element) => element.props['name'] !== undefined && element.props['type'] !== undefined);
    const button = all.find((element) => element.props['aria-pressed'] !== undefined);
    if (input === undefined || button === undefined) throw new Error('the control is missing a part');
    return { input, button, wrapper: all[0] as ReactElement<Props> };
  };
  return { parts, set: (next: Props) => void (props = { ...props, ...next }) };
}

describe('the field and its button', () => {
  it('is one wrapper that holds the input and the button, the button inside the field at its right edge', () => {
    const { wrapper, input, button } = mount().parts();
    expect(wrapper.props['className']).toContain('relative');
    expect(input.props['className']).toMatch(/pr-\(--control-h\)/);
    expect(button.props['className']).toContain('absolute');
    // The button's box is the field's height (a 44 px target, NFR-017); its fill stops inside the field's border (a transparent border and a background clipped to the padding box).
    expect(button.props['className']).toMatch(/inset-y-0/);
    expect(button.props['className']).toMatch(/right-0/);
    expect(button.props['className']).toContain('border-transparent');
    expect(button.props['className']).toContain('bg-clip-padding');
  });

  it('is 44 px wide for a finger and 36 px wide from 1024 px with a fine pointer on a compact screen, as tall as the field (its fill inside the border)', () => {
    const { button, input } = mount().parts();
    expect(button.props['className']).toContain('w-(--control-h)');
    expect(button.props['className']).toContain('compact-fine:w-(--compact-field-h)');
    expect(input.props['className']).toContain('compact-fine:pr-(--compact-field-h)');
  });

  it('is a button that submits nothing, named for what it does, and pressed when the password is shown', () => {
    const initial = mount().parts().button;
    expect(initial.props['type']).toBe('button');
    expect(initial.props['aria-label']).toBe('Show password');
    expect(initial.props['aria-pressed']).toBe(false);
  });
});

describe('the review of AQP-787 (SEC-787-01, QLT-787-01 to QLT-787-04)', () => {
  it('commits the reset of a page that is left at once (flushSync), so a page frozen into the back/forward cache holds a hidden password', () => {
    const control = mount();
    (control.parts().button.props['onClick'] as () => void)();
    expect(control.parts().input.props['type']).toBe('text');
    const before = flushed.count;
    pageListeners.get('pagehide')?.();
    expect(flushed.count).toBe(before + 1);
    expect(control.parts().input.props['type']).toBe('password');
  });

  it('hides the eye that Edge draws inside a password field, so there is one eye', () => {
    expect(mount().parts().input.props['className']).toContain('[&::-ms-reveal]:hidden');
  });

  it('disables the button with the field, so a disabled field has no live eye', () => {
    expect(mount({ disabled: true }).parts().button.props['disabled']).toBe(true);
    expect(mount().parts().button.props['disabled']).toBeFalsy();
  });

  it('keeps the thick border of an invalid field clear of the button\'s fill', () => {
    const { input, button } = mount().parts();
    expect(input.props['className']).toContain('peer');
    expect(button.props['className']).toContain('peer-aria-invalid:border-y-2');
    expect(button.props['className']).toContain('peer-aria-invalid:border-r-2');
  });
});

describe('what stays as it was, for the password managers and the form', () => {
  it('keeps the input an input of type password with the name, id and autocomplete it was given, and the caller\'s own props', () => {
    const { input } = mount({ autoComplete: 'new-password', 'aria-describedby': 'hint', required: true }).parts();
    expect(input.props['type']).toBe('password');
    expect(input.props).toMatchObject({ name: 'password', id: 'password', autoComplete: 'new-password', 'aria-describedby': 'hint', required: true });
  });

  it('adds nothing of the password to any attribute: it has no value of its own', () => {
    const { input } = mount().parts();
    expect(input.props['value']).toBeUndefined();
    expect(input.props['defaultValue']).toBeUndefined();
  });

  it('does not take the caller\'s class away', () => {
    expect(mount({ className: 'invented-class' }).parts().input.props['className']).toContain('invented-class');
  });
});

describe('showing and hiding', () => {
  it('shows the password as text and says so, then hides it again', () => {
    const control = mount();
    (control.parts().button.props['onClick'] as () => void)();
    const shown = control.parts();
    expect(shown.input.props['type']).toBe('text');
    expect(shown.button.props['aria-pressed']).toBe(true);
    expect(shown.button.props['aria-label']).toBe('Hide password');
    (shown.button.props['onClick'] as () => void)();
    expect(control.parts().input.props['type']).toBe('password');
  });

  it('hides it again when the field becomes invalid (an error), and not when it stops being invalid', () => {
    const control = mount();
    (control.parts().button.props['onClick'] as () => void)();
    expect(control.parts().input.props['type']).toBe('text');
    control.set({ 'aria-invalid': true });
    // React renders again at once when a state is set while rendering; the harness does not, so the second read is the one React would have drawn.
    control.parts();
    expect(control.parts().input.props['type']).toBe('password');
    (control.parts().button.props['onClick'] as () => void)();
    expect(control.parts().input.props['type']).toBe('text');
    control.set({ 'aria-invalid': undefined });
    expect(control.parts().input.props['type']).toBe('text');
  });
});

describe('hideWhenLeft: a submit of the form and a page that is left hide the password again', () => {
  function fakes() {
    const listeners = new Map<string, Set<() => void>>();
    const target = (name: string) => ({
      addEventListener: (type: string, listener: () => void) => void listeners.set(`${name}:${type}`, (listeners.get(`${name}:${type}`) ?? new Set()).add(listener)),
      removeEventListener: (type: string, listener: () => void) => void listeners.get(`${name}:${type}`)?.delete(listener),
    });
    const form = target('form');
    const page = target('page');
    const fire = (key: string) => listeners.get(key)?.forEach((listener) => listener());
    const count = () => [...listeners.values()].reduce((sum, set) => sum + set.size, 0);
    return { form, page, fire, count, node: { closest: (selector: string) => (selector === 'form' ? form : null) } };
  }

  it('hides on the form\'s submit and on pagehide, and takes both listeners away with the control', () => {
    const { page, fire, count, node } = fakes();
    const hide = vi.fn();
    const stop = hideWhenLeft(node as unknown as Element, hide, page as unknown as Window);
    fire('form:submit');
    fire('page:pagehide');
    expect(hide).toHaveBeenCalledTimes(2);
    stop();
    expect(count()).toBe(0);
  });

  it('still hides on pagehide for a control that is in no form', () => {
    const { page, fire } = fakes();
    const hide = vi.fn();
    hideWhenLeft({ closest: () => null } as unknown as Element, hide, page as unknown as Window);
    fire('page:pagehide');
    expect(hide).toHaveBeenCalledTimes(1);
  });
});
