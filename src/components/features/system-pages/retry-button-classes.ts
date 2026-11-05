/**
 * The look of the shared secondary `Button` (`components/ui/button.tsx`: 44 px high, 14 / 600, outlined, pressed fill),
 * written out for the error boundary. `app/error.tsx` is a client component that every page loads, and the shared `Button`
 * brings `class-variance-authority` and Radix's `Slot` with it (PRF-01, NFR-009). `tests/unit/system-pages.test.ts` holds
 * the two together: every class here must be one the shared button gives its secondary variant, so a change to the button
 * that this copy misses fails a test.
 */
export const RETRY_BUTTON_CLASSES =
  'inline-flex items-center justify-center gap-s-2 rounded-md border border-border-strong bg-surface text-ink text-body font-semibold leading-none whitespace-nowrap no-underline select-none transition-colors duration-200 ease-out active:transition-none cursor-pointer h-(--control-h) px-s-4 hover:bg-surface-2 hover:text-ink active:bg-border active:text-ink active:shadow-pressed [-webkit-touch-callout:none]';
