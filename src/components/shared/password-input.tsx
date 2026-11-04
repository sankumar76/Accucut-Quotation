'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState, type ComponentProps } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { Icon } from './icon';

export type PasswordInputProps = Omit<ComponentProps<typeof Input>, 'type'>;

/**
 * A password field with a show and hide button (SCR-01, SCR-23: UX spec section 6.0 "Forms"). The button is a toggle:
 * `aria-pressed` says whether the password is shown and its name changes with it. Paste is never blocked and
 * `autocomplete` is the caller's (`current-password` or `new-password`). Everything else is passed to the input, `ref`
 * and the label wiring from `FormField` included.
 */
export function PasswordInput(props: PasswordInputProps) {
  const [shown, setShown] = useState(false);
  return (
    <div className="flex gap-s-2">
      <Input {...props} type={shown ? 'text' : 'password'} />
      <Button
        variant="secondary"
        size="icon"
        className="shrink-0"
        aria-pressed={shown}
        aria-label={shown ? 'Hide password' : 'Show password'}
        onClick={() => setShown((current) => !current)}
      >
        <Icon icon={shown ? EyeOff : Eye} size="large" />
      </Button>
    </div>
  );
}
