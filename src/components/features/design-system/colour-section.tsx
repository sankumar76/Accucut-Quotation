import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MINIMUM_RATIO } from '@/lib/contrast';
import { COLOUR_TOKENS, CONTRAST_PAIRS, type ColourTokenName } from '@/lib/design-tokens';

import { DsSection } from './section';
import { TokenValue } from './token-value';

/** Static class names, so Tailwind sees each one. TypeScript requires an entry for every colour token. */
const SWATCH_CLASS: Readonly<Record<ColourTokenName, string>> = {
  '--primary': 'bg-primary',
  '--primary-hover': 'bg-primary-hover',
  '--primary-ink': 'bg-primary-ink',
  '--nav': 'bg-nav',
  '--ink': 'bg-ink',
  '--ink-2': 'bg-ink-2',
  '--ink-3': 'bg-ink-3',
  '--border-strong': 'bg-border-strong',
  '--accent': 'bg-accent',
  '--accent-ink': 'bg-accent-ink',
  '--success': 'bg-success',
  '--danger': 'bg-danger',
  '--info-ink': 'bg-info-ink',
  '--bg': 'bg-canvas',
  '--surface': 'bg-surface',
  '--surface-2': 'bg-surface-2',
};

const STATED_PAIRS = CONTRAST_PAIRS.filter((pair) => pair.stated !== undefined);
const formatRatio = (ratio: number): string => `${ratio.toFixed(2)}:1`;

/** The printed ratios (UX spec section 7.3) in which a token is the foreground or the background. */
function ratiosFor(name: string): ReadonlyArray<string> {
  return STATED_PAIRS.flatMap((pair) => {
    if (pair.stated === undefined) return [];
    if (pair.foreground === name) return [`${formatRatio(pair.stated)} on ${pair.background}`];
    if (pair.background === name) return [`${formatRatio(pair.stated)} with ${pair.foreground}`];
    return [];
  });
}

/** SCR-00 section 02: the colour tokens with their values (live) and ratios, then every pair in a table. */
export function ColourSection() {
  return (
    <DsSection number="02" id="ds-colour" title="Colour tokens" aside="Values are read from the page; ratios are tested">
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-s-4">
        {COLOUR_TOKENS.map((token) => {
          const ratios = ratiosFor(token.name);
          return (
            <li key={token.name} className="flex flex-col gap-s-1">
              <span aria-hidden="true" className={`h-s-7 rounded-md border border-border ${SWATCH_CLASS[token.name]}`} />
              <span className="text-label font-semibold text-ink">{token.label}</span>
              <span className="text-label text-ink-2">
                <span className="font-mono">{token.name}</span> · <TokenValue name={token.name} />
              </span>
              <span className="text-label text-ink-2">{token.use}</span>
              {ratios.length === 0 ? (
                <span className="text-label text-ink-2">Background; no text pair is printed</span>
              ) : (
                ratios.map((ratio) => (
                  <span key={ratio} className="text-label text-ink-2">
                    {ratio}
                  </span>
                ))
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-s-3">
        <h3 className="text-body font-semibold text-ink">Contrast pairs</h3>
        <p className="text-ink-2">
          Normal text needs {formatRatio(MINIMUM_RATIO.normalText)}; large text and interface parts need {formatRatio(MINIMUM_RATIO.largeTextOrUi)}.
          Red is text only as <span className="font-mono">--primary-ink</span>; the brand red is for fills with white text and for markers.
        </p>
        <Table regionLabel="Contrast pairs, scrollable" caption="Text and background pairs with their contrast ratio and the ratio they need">
          <TableHeader>
            <TableRow>
              <TableHead>Text or part</TableHead>
              <TableHead>On</TableHead>
              <TableHead>Ratio</TableHead>
              <TableHead>Needs</TableHead>
              <TableHead>Use</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {STATED_PAIRS.map((pair) => (
              <TableRow key={`${pair.foreground}-${pair.background}`}>
                <TableCell className="font-mono text-label">{pair.foreground}</TableCell>
                <TableCell className="font-mono text-label">{pair.background}</TableCell>
                <TableCell>
                  <Badge tone="success">{pair.stated === undefined ? '' : formatRatio(pair.stated)}</Badge>
                </TableCell>
                <TableCell>{formatRatio(pair.minimum)}</TableCell>
                <TableCell className="text-ink-2">{pair.note}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </DsSection>
  );
}
