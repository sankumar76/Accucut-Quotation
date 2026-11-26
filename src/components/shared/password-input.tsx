'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useRef, useState, type ComponentProps } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';

import { Icon } from './icon';

export type PasswordInputProps = Omit<ComponentProps<typeof Input>, 'type'>;

/** What `hideWhenLeft` listens on: the form's submit and the page's pagehide. A parameter so a test can hand in plain objects. */
interface Listens {
  readonly addEventListener: (type: string, listener: () => void) => void;
  readonly removeEventListener: (type: string, listener: () => void) => void;
}

/**
 * Hides the password again when the form it is in is submitted, and when the page is left (a navigation, or a page that goes into the browser's back/forward cache comes back hidden). Answers the way to stop
 * listening. The caller also hides it when the field becomes invalid (an error). A control in no form still hides on `pagehide`.
 */
export function hideWhenLeft(node: Element | null, hide: () => void, page: Listens = window): (() => void) | undefined {
  const form: Listens | null = node?.closest('form') ?? null;
  form?.addEventListener('submit', hide);
  page.addEventListener('pagehide', hide);
  return () => {
    form?.removeEventListener('submit', hide);
    page.removeEventListener('pagehide', hide);
  };
}

/**
 * A password field with a show and hide button **inside the field**, at its right edge (SCR-01, SCR-23 and the password steps of the dialogs: UX spec section 6.0 "Forms"; the ux-expert's answer of 2026-11-26 to
 * DEF-102 / AQP-459). The button is a toggle that submits nothing (`type="button"`): `aria-pressed` says whether the password is shown and its name changes with it. Its box is as tall as the field (a 44 px target; 36 px from 1024 px
 * with a fine pointer on a compact screen, WCAG 2.5.8, NFR-017) and 44 px wide, and its hover fill stops inside the field's border (a transparent border, the background clipped to the padding box). Paste is never blocked and `autocomplete` is the caller's (`current-password` or `new-password`), so a password manager sees
 * the same one input with its name and id. The password is hidden again when the form is submitted, when the page is left and when the field becomes invalid. Everything else is passed to the input, `ref` and the
 * label wiring from `FormField` included.
 */
export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [shown, setShown] = useState(false);
  // An error hides the password again: the state is adjusted while rendering, when `aria-invalid` turns on.
  const invalid = props['aria-invalid'] === true || props['aria-invalid'] === 'true';
  const [wasInvalid, setWasInvalid] = useState(invalid);
  if (invalid !== wasInvalid) {
    setWasInvalid(invalid);
    if (invalid) setShown(false);
  }
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => hideWhenLeft(box.current, () => setShown(false)), []);
  return (
    <div ref={box} className="relative">
      <Input {...props} type={shown ? 'text' : 'password'} className={cn('pr-(--control-h) compact-fine:pr-(--compact-field-h)', className)} />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute inset-y-0 right-0 h-auto w-(--control-h) rounded-l-none rounded-r-md border-y border-r border-transparent bg-clip-padding compact-fine:w-(--compact-field-h)"
        aria-pressed={shown}
        aria-label={shown ? 'Hide password' : 'Show password'}
        onClick={() => setShown((current) => !current)}
      >
        <Icon icon={shown ? EyeOff : Eye} size="large" />
      </Button>
    </div>
  );
}
