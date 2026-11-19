import { test } from '@playwright/test';

/** TEMPORARY DIAGNOSTIC (AQP-377, DEF-048): prints how long each phase of three named cases takes. Removed before the fix is final. */
const WATCHED = [/^AC-8: no sideways scroll/, /^AC-2: with every treatment chosen/, /^AC-3: a part with 2 sub-parts/];
const clocks = new WeakMap<object, { start: number; last: number }>();

export function mark(label: string, extra = ''): void {
  const info = test.info();
  if (!WATCHED.some((pattern) => pattern.test(info.title))) return;
  const now = Date.now();
  const clock = clocks.get(info) ?? { start: now, last: now };
  clocks.set(info, clock);
  const line = `[DEF048] ${info.project.name} r${info.retry} "${info.title.slice(0, 22)}" ${label} step=${now - clock.last}ms total=${now - clock.start}ms ${extra}`;
  clock.last = now;
  process.stdout.write(`${line}\n`);
}
