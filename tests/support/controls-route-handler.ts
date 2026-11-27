/**
 * The answer of the route that holds or refuses the code of the resizable tree's controls (AQP-426; `tests/e2e/support/tree-width.ts`, DEF-085, DL-391), as a function of its own so the part that decides what to do with a
 * fault can be proved without a browser (DEF-088, AQP-444). This file has no tests and imports nothing from Playwright at run time.
 */

/** What only the code of the handle and of the Tree width menu contains: their own attributes. The development server hashes most chunk names, so the chunk is told by its content. */
export const CONTROLS_MARKERS: ReadonlyArray<string> = ['data-tree-hit', 'data-tree-width-button'];

/**
 * The faults of a request that the browser has already dropped: the page was reloaded, or the page or context was closed, while the answer was being made (`route.fetch`: "Request context disposed", `response.text`:
 * "Response has been disposed", `route.fulfill`: "Route is already handled"). Nothing is left to answer. These exact messages only: every other fault is the test's.
 */
const DROPPED = /Request context disposed|Response has been disposed|Route is already handled/;

export const isDroppedRequest = (error: unknown): boolean => error instanceof Error && DROPPED.test(error.message);

/**
 * The one fault of the teardown that is not the test's (AQP-444, DEF-088 reopened; DL-419 (B)): `page.unrouteAll` answers "Target page, context or browser has been closed" when the page or the context is already gone,
 * which is what a case that has timed out leaves behind. Nothing is left to unroute then. This exact message only.
 */
const TARGET_CLOSED = /Target page, context or browser has been closed/;

export const isClosedTarget = (error: unknown): boolean => error instanceof Error && TARGET_CLOSED.test(error.message);

/** Runs the unroute at teardown and ignores exactly the fault of a page that is already closed; every other fault is rethrown, so a real one is never hidden. */
export async function stopRoutes(unroute: () => Promise<void>): Promise<void> {
  try {
    await unroute();
  } catch (error) {
    if (!isClosedTarget(error)) throw error;
  }
}

/** The part of a fetched chunk that is read. */
export interface FetchedChunk {
  readonly text: () => Promise<string>;
}

/** The part of Playwright's `Route` that the handler uses, so a test can hand in a plain object. */
export interface ChunkRoute<Fetched extends FetchedChunk> {
  readonly fetch: () => Promise<Fetched>;
  readonly fulfill: (options: { readonly response?: Fetched; readonly body?: string; readonly status?: number; readonly contentType?: string }) => Promise<void>;
}

/**
 * Fetches the chunk, and then lets it through at once, unless it carries the controls' markers: that one is answered 503 (`'refuse'`) or answered once `held` settles (`'hold'`). A fault of a dropped request (above) ends the
 * handler quietly; any other fault is thrown, so a real fault is never hidden.
 */
export async function answerChunk<Fetched extends FetchedChunk>(route: ChunkRoute<Fetched>, mode: 'hold' | 'refuse', held: Promise<void>): Promise<void> {
  try {
    const response = await route.fetch();
    const body = await response.text();
    if (!CONTROLS_MARKERS.some((marker) => body.includes(marker))) return await route.fulfill({ response, body });
    if (mode === 'refuse') return await route.fulfill({ status: 503, contentType: 'text/plain', body: 'refused' });
    await held;
    return await route.fulfill({ response, body });
  } catch (error) {
    if (!isDroppedRequest(error)) throw error;
  }
}
