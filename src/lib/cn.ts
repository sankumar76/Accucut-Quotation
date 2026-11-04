import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * The theme's own text sizes (`text-heading`, `text-sub`, `text-body`, `text-label`) and its 4-point spacing
 * (`p-s-1` to `p-s-7`), as named in `src/app/globals.css`. `tailwind-merge` does not know custom names: without
 * them it reads `text-body` as a colour and drops it when a colour follows (architect ruling on AQP-28, Jira
 * 10705). `tests/unit/cn.test.ts` reads the token file and fails if a name is added there and not here.
 */
export const THEME_TEXT_SIZES = ['heading', 'sub', 'body', 'label'] as const;
export const THEME_SPACING = ['s-1', 's-2', 's-3', 's-4', 's-5', 's-6', 's-7'] as const;

const mergeClasses = extendTailwindMerge({
  extend: {
    theme: {
      text: [...THEME_TEXT_SIZES],
      spacing: [...THEME_SPACING],
      shadow: ['card', 'overlay'],
      animate: ['shimmer', 'sheet-in', 'sheet-out', 'fade-in', 'fade-out'],
    },
  },
});

export type { ClassValue };

/**
 * Joins class names (`clsx`: strings, arrays, objects, falsy values dropped) and resolves conflicts between
 * Tailwind utilities, the later one winning, so a component can set a default and a caller can override it:
 * `cn('border-transparent', variantBorder, className)`. This is the `cn` that shadcn/ui components import
 * (`components.json`, `aliases.utils`).
 */
export function cn(...values: ReadonlyArray<ClassValue>): string {
  return mergeClasses(clsx(values));
}
