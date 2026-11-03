import { cn } from '@/lib/cn';

const KIND_CLASSES = {
  /** An input column: dark tag. */
  input: 'bg-nav text-on-fill',
  /** An output column: grey tag. */
  output: 'bg-surface-2 text-ink-2',
  /** An auto-filled column: grey tag with an edge. */
  auto: 'border border-border-strong bg-surface-2 text-ink-2',
} as const;

export type ColumnTagKind = keyof typeof KIND_CLASSES;

export interface ColumnTagProps {
  /** The Excel column letter, taken from the field registry (UX spec section 6.0 "Column letters"); never typed into a screen. */
  readonly letter: string;
  readonly kind?: ColumnTagKind;
}

/** The Excel column letter beside a label, read by a screen reader as "Excel column J". */
export function ColumnTag({ letter, kind = 'input' }: ColumnTagProps) {
  return (
    <span className={cn('inline-flex h-s-5 items-center rounded-sm px-s-1 font-mono text-label leading-none font-medium', KIND_CLASSES[kind])}>
      <span className="sr-only">Excel column </span>
      {letter}
    </span>
  );
}
