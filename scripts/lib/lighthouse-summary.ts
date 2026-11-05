/**
 * The Lighthouse reference run's summary (NFR-009; test strategy section 10.2; STORY-10.10 AC-7).
 *
 * From the reports a run keeps, this takes each page's median LCP and TBT over the runs, and the median
 * `benchmarkIndex` (Lighthouse's measure of how fast the machine was). The baseline run records that median as B0; a
 * later run whose median index is more than 25 % away from B0 is marked "not comparable", because a slower or faster
 * runner changes the numbers without the page changing. The functions are pure: the files are read by the entry point.
 */
import { z } from 'zod';

/** A run more than this fraction away from B0 is not comparable (test strategy 10.2). */
export const COMPARABLE_FRACTION = 0.25;

const auditSchema = z.object({ numericValue: z.number().optional() });
const lhrSchema = z.object({
  finalDisplayedUrl: z.string().optional(),
  finalUrl: z.string().optional(),
  requestedUrl: z.string().optional(),
  audits: z.object({ 'largest-contentful-paint': auditSchema, 'total-blocking-time': auditSchema }),
  environment: z.object({ benchmarkIndex: z.number(), hostUserAgent: z.string().optional() }),
});

/** One Lighthouse run, reduced to what the summary needs. */
export interface RunFigures {
  /** The page that was asked for: path and query, no port. */
  readonly url: string;
  /** The path the browser ended on. It differs from the asked-for path when the page redirected (for example to sign-in). */
  readonly finalPath: string;
  readonly lcpMs: number | undefined;
  readonly tbtMs: number | undefined;
  readonly benchmarkIndex: number;
  readonly chromium: string | undefined;
}

const CHROME_VERSION = /Chrome\/([\d.]+)/;
/** The file that Lighthouse CI's filesystem target writes for each run (`<host>-<path>-<time>.report.json`), beside a manifest and the HTML. */
export const REPORT_FILE = /\.report\.json$/;

/** The path and query of a page address, so a random port never reaches the table. */
function shownUrl(address: string): string {
  try {
    const parsed = new URL(address);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return address;
  }
}

function pathOf(shown: string): string {
  return shown.split('?')[0] ?? shown;
}

/** The figures of one report, or `undefined` when the text is not a Lighthouse report with the audits the summary reads. */
export function parseRun(text: string): RunFigures | undefined {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return undefined;
  }
  const parsed = lhrSchema.safeParse(json);
  if (!parsed.success) return undefined;
  const { audits, environment } = parsed.data;
  const requested = parsed.data.requestedUrl ?? parsed.data.finalDisplayedUrl ?? parsed.data.finalUrl ?? '(unknown page)';
  const final = parsed.data.finalDisplayedUrl ?? parsed.data.finalUrl ?? requested;
  return {
    url: shownUrl(requested),
    finalPath: pathOf(shownUrl(final)),
    lcpMs: audits['largest-contentful-paint'].numericValue,
    tbtMs: audits['total-blocking-time'].numericValue,
    benchmarkIndex: environment.benchmarkIndex,
    chromium: CHROME_VERSION.exec(environment.hostUserAgent ?? '')?.[1],
  };
}

export function medianOf(values: ReadonlyArray<number>): number | undefined {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return undefined;
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  const lower = sorted[middle - 1];
  const upper = sorted[middle];
  return lower === undefined || upper === undefined ? undefined : (lower + upper) / 2;
}

export interface PageFigures {
  readonly url: string;
  readonly runs: number;
  readonly medianLcpMs: number | undefined;
  readonly medianTbtMs: number | undefined;
  /** The path some run ended on when it was not the page asked for: the page redirected, so the figures are not its own. */
  readonly redirectedTo: string | undefined;
}

export interface ProfileSummary {
  readonly pages: ReadonlyArray<PageFigures>;
  readonly medianBenchmarkIndex: number | undefined;
  readonly chromium: string | undefined;
}

const defined = (values: ReadonlyArray<number | undefined>): number[] => values.filter((value): value is number => value !== undefined);

/** Medians per page, in the order the pages first appear, and the median benchmark index over every run. */
export function summariseProfile(runs: ReadonlyArray<RunFigures>): ProfileSummary {
  const urls = [...new Set(runs.map((run) => run.url))];
  return {
    pages: urls.map((url) => {
      const own = runs.filter((run) => run.url === url);
      return {
        url,
        runs: own.length,
        medianLcpMs: medianOf(defined(own.map((run) => run.lcpMs))),
        medianTbtMs: medianOf(defined(own.map((run) => run.tbtMs))),
        redirectedTo: own.find((run) => run.finalPath !== pathOf(run.url))?.finalPath,
      };
    }),
    medianBenchmarkIndex: medianOf(runs.map((run) => run.benchmarkIndex)),
    chromium: runs.find((run) => run.chromium !== undefined)?.chromium,
  };
}

export type Comparability =
  | { readonly kind: 'baseline' }
  | { readonly kind: 'comparable'; readonly deviation: number }
  | { readonly kind: 'not-comparable'; readonly deviation: number };

/**
 * Whether a run's median index can be compared with the baseline B0. With no B0 this is the baseline run itself. A
 * deviation of exactly 25 % is still comparable; anything over is not.
 */
export function comparability(medianIndex: number, b0: number | undefined): Comparability {
  if (b0 === undefined) return { kind: 'baseline' };
  const deviation = Math.abs(medianIndex - b0) / b0;
  return deviation > COMPARABLE_FRACTION ? { kind: 'not-comparable', deviation } : { kind: 'comparable', deviation };
}

/** B0 from a setting: a positive number, or `undefined` for an empty or unusable value. */
export function parseBaseline(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

/** The pages whose runs ended on another page. A sign-in that did not take shows up here, as the sign-in page's figures under the wrong name. */
export function redirectedPages(summary: ProfileSummary): string[] {
  return summary.pages.filter((page) => page.redirectedTo !== undefined).map((page) => `${page.url} (ended on ${page.redirectedTo})`);
}

const whole = (value: number | undefined): string => (value === undefined ? 'n/a' : String(Math.round(value)));
const percent = (fraction: number): string => `${(fraction * 100).toFixed(1)} %`;

function comparabilityLine(summary: ProfileSummary, b0: number | undefined): string {
  if (summary.medianBenchmarkIndex === undefined) return 'No benchmark index was reported.';
  const index = whole(summary.medianBenchmarkIndex);
  const result = comparability(summary.medianBenchmarkIndex, b0);
  switch (result.kind) {
    case 'baseline':
      return `Median benchmarkIndex ${index}. No B0 is set, so this is a baseline run: record ${index} as B0.`;
    case 'comparable':
      return `Median benchmarkIndex ${index}, ${percent(result.deviation)} from B0 ${whole(b0)}: comparable.`;
    case 'not-comparable':
      return `Median benchmarkIndex ${index}, ${percent(result.deviation)} from B0 ${whole(b0)}: NOT COMPARABLE (more than 25 % away). Re-run; if it happens again, take a new baseline.`;
  }
}

/** The job-summary section for one profile. */
export function profileMarkdown(title: string, summary: ProfileSummary, b0: number | undefined): string {
  const note = (page: PageFigures): string => (page.redirectedTo === undefined ? '' : `NOT THIS PAGE: ended on ${page.redirectedTo}`);
  const rows = summary.pages.map((page) => `| ${page.url} | ${page.runs} | ${whole(page.medianLcpMs)} | ${whole(page.medianTbtMs)} | ${note(page)} |`);
  return [
    `#### ${title}`,
    '',
    '| Page | Runs | LCP median (ms) | TBT median (ms) | Note |',
    '| --- | --- | --- | --- | --- |',
    ...(rows.length === 0 ? ['| (no report) | 0 | n/a | n/a | |'] : rows),
    '',
    `${comparabilityLine(summary, b0)} Chromium ${summary.chromium ?? 'unknown'}.`,
  ].join('\n');
}
