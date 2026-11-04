import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/cn';

/** `input` is a dark tag, `output` a grey tag, `auto` a grey tag with an edge. */
const columnTagVariants = cva('inline-flex h-s-5 items-center rounded-sm px-s-1 font-mono text-label leading-none font-medium', {
  variants: {
    kind: {
      input: 'bg-nav text-on-fill',
      output: 'bg-surface-2 text-ink-2',
      auto: 'border border-border-strong bg-surface-2 text-ink-2',
    },
  },
  defaultVariants: { kind: 'input' },
});

export interface ColumnTagProps extends VariantProps<typeof columnTagVariants> {
  /** The Excel column letter, taken from the field registry (UX spec section 6.0 "Column letters"); never typed into a screen. */
  readonly letter: string;
}

/** The Excel column letter beside a label, read by a screen reader as "Excel column J". */
export function ColumnTag({ letter, kind }: ColumnTagProps) {
  return (
    <span className={cn(columnTagVariants({ kind }))}>
      <span className="sr-only">Excel column </span>
      {letter}
    </span>
  );
}
