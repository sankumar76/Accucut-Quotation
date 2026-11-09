'use client';

import { Search } from 'lucide-react';
import type { RefObject } from 'react';

import { Icon } from '@/components/shared/icon';
import { CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * The search box above a master's list (SCR-11 "Search", SCR-13): one labelled search field in the card's top band, 44 px high, that
 * filters the list as the person types. It holds no state; the screen owns the query. A master that is not the Process Master uses it
 * with its own id, label and placeholder.
 */

export interface MasterSearchBoxProps {
  /** Unique on the page; the label points at it. */
  readonly id: string;
  readonly label: string;
  readonly placeholder: string;
  readonly query: string;
  readonly onChange: (query: string) => void;
  readonly inputRef: RefObject<HTMLInputElement | null>;
}

export function MasterSearchBox({ id, label, placeholder, query, onChange, inputRef }: MasterSearchBoxProps) {
  return (
    <CardContent className="border-b border-border">
      <div className="flex max-w-120 flex-col gap-s-2">
        <Label htmlFor={id}>{label}</Label>
        <div className="relative">
          <Icon icon={Search} size="small" className="pointer-events-none absolute top-1/2 left-s-3 -translate-y-1/2 text-ink-2" />
          <Input
            ref={inputRef}
            id={id}
            type="search"
            autoComplete="off"
            placeholder={placeholder}
            className="pl-s-7"
            value={query}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      </div>
    </CardContent>
  );
}
