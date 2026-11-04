'use client';

import { useSyncExternalStore } from 'react';

const subscribeNever = (): (() => void) => () => undefined;
const SERVER_VALUE = '';

/**
 * The live value of a CSS custom property, read from the page, so the design-system page shows the tokens
 * that are in effect and never a copy that could drift from globals.css (NFR-020). The server renders a
 * dash; the browser fills the value in on hydration.
 */
export function TokenValue({ name }: { readonly name: string }) {
  const value = useSyncExternalStore(
    subscribeNever,
    () => getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
    () => SERVER_VALUE,
  );
  return <span className="font-mono">{value === '' ? '—' : value.toUpperCase()}</span>;
}
