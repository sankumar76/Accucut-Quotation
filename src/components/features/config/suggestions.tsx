'use client';

import { useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';

import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import { applySuggestion, suggestionsFor, wordBeforeCaret, type Suggestion, type SuggestionSource } from '@/lib/config/formula-suggestions';

import { SUGGESTION_KIND_LABELS, SUGGESTIONS_LABEL } from './formula-editor-texts';

/**
 * The formula box with its suggestion list (STORY-08.02 AC-1, AC-10; SCR-18): a monospace text area that offers column letters with their field names, rate names, the operands and the functions for the
 * word being typed. It is an ARIA combobox: the text area keeps focus, the list is a listbox, and the highlighted option is named by `aria-activedescendant`, so a keyboard user does everything without
 * leaving the box. Arrow Down and Arrow Up move through the list, Enter or Tab choose, Escape closes it (and only it: the page's own Escape handling is not reached). The list is in the page flow below
 * the box, never over it, so it covers nothing at 360 px. What is offered and what a choice does to the text are `lib/config/formula-suggestions.ts`.
 */

export interface FormulaInputProps {
  readonly id: string;
  readonly value: string;
  readonly onChange: (text: string) => void;
  readonly source: SuggestionSource;
  readonly invalid: boolean;
  readonly describedBy: string;
  readonly inputRef?: RefObject<HTMLTextAreaElement | null>;
}

export function FormulaInput({ id, value, onChange, source, invalid, describedBy, inputRef }: FormulaInputProps) {
  const own = useRef<HTMLTextAreaElement>(null);
  const textarea = inputRef ?? own;
  const [caret, setCaret] = useState(value.length);
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const pendingCaret = useRef<number | null>(null);

  const word = wordBeforeCaret(value, caret);
  const shown = dismissed ? [] : suggestionsFor(word, source);
  const open = shown.length > 0;
  const listId = `${id}-suggestions`;
  const optionId = (index: number): string => `${id}-option-${String(index)}`;
  // The highlighted option can be past the end when the list got shorter while typing.
  const current = Math.min(active, Math.max(shown.length - 1, 0));

  // The caret goes after the chosen name once React has put the new text in the box.
  useLayoutEffect(() => {
    if (pendingCaret.current === null) return;
    textarea.current?.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  });

  function choose(suggestion: Suggestion): void {
    if (word === null) return;
    const applied = applySuggestion(value, caret, word, suggestion);
    pendingCaret.current = applied.caret;
    setCaret(applied.caret);
    setActive(0);
    onChange(applied.text);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (!open) return;
    const chosen = shown[current];
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((current + 1) % shown.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((current - 1 + shown.length) % shown.length);
    } else if ((event.key === 'Enter' || event.key === 'Tab') && chosen !== undefined) {
      event.preventDefault();
      choose(chosen);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setDismissed(true);
    }
  }

  return (
    <div className="flex flex-col gap-s-2">
      <Textarea
        id={id}
        ref={textarea}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open ? optionId(current) : undefined}
        aria-describedby={describedBy}
        aria-invalid={invalid ? true : undefined}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        rows={5}
        className="min-h-30 font-mono"
        value={value}
        onChange={(event) => {
          setCaret(event.target.selectionStart);
          setActive(0);
          setDismissed(false);
          onChange(event.target.value);
        }}
        onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
        onKeyDown={onKeyDown}
      />
      <ul
        id={listId}
        role="listbox"
        aria-label={SUGGESTIONS_LABEL}
        hidden={!open}
        className="flex max-h-60 flex-col overflow-y-auto rounded-md border border-border bg-surface shadow-overlay"
      >
        {shown.map((suggestion, index) => (
          <li
            key={`${suggestion.kind}-${suggestion.insert}`}
            id={optionId(index)}
            role="option"
            aria-selected={index === current}
            // The box keeps focus: a press on an option must not move it.
            onMouseDown={(event) => {
              event.preventDefault();
              choose(suggestion);
            }}
            className={cn('flex cursor-pointer items-center gap-s-3 px-s-3 py-s-2 text-body text-ink', index === current ? 'bg-surface-2' : undefined)}
          >
            <span className="min-w-s-7 rounded-sm bg-surface-2 px-s-1 font-mono text-label font-medium text-ink-2">{suggestion.kind === 'function' ? suggestion.label : suggestion.insert}</span>
            <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{suggestion.kind === 'field' ? suggestion.label : null}</span>
            <span className="text-label text-ink-3">{SUGGESTION_KIND_LABELS[suggestion.kind]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
