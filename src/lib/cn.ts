/** A class-name value: a string, or something falsy that is dropped (`cond && 'class'`). */
export type ClassValue = string | false | null | undefined;

/**
 * Joins class names and drops the falsy ones, so a component can write `cn('base', isOn && 'on', className)`.
 *
 * shadcn/ui components use `clsx` and `tailwind-merge` for this. Neither is in the approved stack
 * (architecture section 11), so this is the small subset the components need. It does not resolve two
 * conflicting utilities: a component sets a default and a caller adds to it, never overrides it.
 */
export function cn(...values: ReadonlyArray<ClassValue>): string {
  return values.filter((value): value is string => typeof value === 'string' && value !== '').join(' ');
}
