/**
 * Where a task's estimate lives (SCR-05), as the queue links to it. The one place the path is built, so an e-mail's "Open the task" link and the page it opens cannot drift apart
 * (STORY-09.04 AC-7). Plain TypeScript, no imports: the web process and the worker both use it. The caller puts `APP_ORIGIN` in front to make a full address.
 */
export const estimatePathOf = (code: string): string => `/estimates/${encodeURIComponent(code)}`;
