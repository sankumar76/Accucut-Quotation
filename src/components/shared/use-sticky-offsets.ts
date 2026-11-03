'use client';

import { useEffect } from 'react';

import { computeStickyOffsets, type StickyBar } from '@/lib/sticky-offsets';

const BAR_SELECTOR = '[data-sticky-bar]';

function readBars(): { elements: HTMLElement[]; bars: StickyBar[] } {
  const elements = Array.from(document.querySelectorAll<HTMLElement>(BAR_SELECTOR));
  const bars = elements.flatMap((element): StickyBar[] => {
    const edge = element.dataset['stickyBar'];
    if (edge !== 'top' && edge !== 'bottom') return [];
    return [{ edge, height: element.getBoundingClientRect().height }];
  });
  return { elements, bars };
}

/**
 * Measures the sticky bars and publishes `--sticky-top` and `--sticky-bottom` on `<html>`, which
 * `scroll-padding` in globals.css reads, so a focused element is never hidden behind a bar (WCAG 2.4.11;
 * architecture section 11 "Sticky bars"). A bar is any element with `data-sticky-bar="top"` or `"bottom"`.
 * A `ResizeObserver` follows each bar's height (an action bar wraps on a phone); a `MutationObserver` picks
 * up bars that a page adds or removes later.
 */
export function useStickyOffsets(): void {
  useEffect(() => {
    const root = document.documentElement;
    const observed = new Set<Element>();

    const measure = (): void => {
      const { elements, bars } = readBars();
      for (const element of elements) {
        if (!observed.has(element)) {
          observed.add(element);
          resizeObserver.observe(element);
        }
      }
      const offsets = computeStickyOffsets(bars);
      root.style.setProperty('--sticky-top', `${offsets.top}px`);
      root.style.setProperty('--sticky-bottom', `${offsets.bottom}px`);
    };

    const resizeObserver = new ResizeObserver(measure);
    const mutationObserver = new MutationObserver(measure);
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    measure();

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      root.style.removeProperty('--sticky-top');
      root.style.removeProperty('--sticky-bottom');
    };
  }, []);
}
