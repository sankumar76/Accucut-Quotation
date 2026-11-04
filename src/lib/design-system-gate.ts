/**
 * `/design-system` (SCR-00) is a review page with invented figures. It is served everywhere except a
 * production build, where the route answers "not found" (STORY-10.02, AC-7, assumption A-1).
 *
 * `NODE_ENV` is `production` for every `next build` and `next start`, so a staging server built from the
 * same image also hides the page; that is the safe side of the rule (architect ruling, Jira 10705). Call it with
 * no argument: every caller then reads the same variable (STD-05).
 */
export function isDesignSystemAvailable(nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
  return nodeEnv !== 'production';
}
