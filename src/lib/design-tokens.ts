import { MINIMUM_RATIO } from './contrast';

/** Icon sizes in pixels, by role. The components take a role (`<Icon size="large" />`), never a bare number (STD-08). */
export const ICON_SIZE = { badge: 12, hint: 14, small: 16, default: 18, large: 20, state: 28 } as const;

export type IconSize = keyof typeof ICON_SIZE;

/** The width at which the side menu becomes persistent. Tailwind's `lg` breakpoint is the same 1024 px. */
export const PERSISTENT_MENU_MIN_WIDTH = 1024;

/** The width from which a tablet layout applies (Tailwind `md`): the parts tree is a collapsible panel from here and a drawer below it (UX spec SCR-05 "Responsive"). */
export const TABLET_MIN_WIDTH = 768;

/**
 * The colour tokens of UX spec section 7.3 and the pairs whose contrast the design system promises.
 * Names only: the values live in `src/app/globals.css`, the one token file (NFR-020), and
 * `tests/unit/tokens.test.ts` reads them from there to check every pair.
 */

export interface ColourToken {
  /** The CSS custom property, as in `docs/03-ux/screens/screens.css`. */
  readonly name: string;
  readonly label: string;
  readonly use: string;
}

export const COLOUR_TOKENS = [
  { name: '--primary', label: 'Primary (logo red)', use: 'Main buttons, active markers, brand name' },
  { name: '--primary-hover', label: 'Primary hover', use: 'Primary button hover' },
  { name: '--primary-ink', label: 'Primary ink', use: 'Red used as text or a link' },
  { name: '--nav', label: 'Graphite (menu)', use: 'Side menu, focus ring, dark badge' },
  { name: '--ink', label: 'Ink', use: 'Body text' },
  { name: '--ink-2', label: 'Ink 2', use: 'Secondary text' },
  { name: '--ink-3', label: 'Ink 3', use: 'Hints and placeholders (lowest grey)' },
  { name: '--border-strong', label: 'Border strong', use: 'Control boundaries' },
  { name: '--accent', label: 'Amber (overdue)', use: 'Overdue bar and count badge' },
  { name: '--accent-ink', label: 'Amber ink', use: 'Text on the amber tint' },
  { name: '--success', label: 'Success', use: 'Approved and complete' },
  { name: '--danger', label: 'Error red', use: 'Errors and delete only' },
  { name: '--info-ink', label: 'Neutral info ink', use: 'Neutral notices and the Submitted badge' },
  { name: '--bg', label: 'Canvas', use: 'Page ground' },
  { name: '--surface', label: 'Surface', use: 'Cards and the top bar' },
  { name: '--surface-2', label: 'Auto-filled', use: 'Read-only and auto-filled fields' },
] as const satisfies ReadonlyArray<ColourToken>;

export type ColourTokenName = (typeof COLOUR_TOKENS)[number]['name'];

export interface ContrastPair {
  readonly foreground: string;
  readonly background: string;
  /** The ratio the pair must reach: 4.5 for normal text, 3 for large text and interface parts. */
  readonly minimum: number;
  /** The ratio printed in UX spec section 7.3, to two decimals. Absent for a pair the spec does not print. */
  readonly stated?: number;
  readonly note: string;
}

const TEXT = MINIMUM_RATIO.normalText;
const UI = MINIMUM_RATIO.largeTextOrUi;

/** A pair whose ratio UX spec section 7.3 prints. */
export type StatedContrastPair = ContrastPair & { readonly stated: number };

/** Every text-and-background pair of UX spec section 7.3, then the pairs the shell uses beyond it. */
export const CONTRAST_PAIRS: ReadonlyArray<ContrastPair> = [
  { foreground: '--on-fill', background: '--primary', minimum: TEXT, stated: 4.59, note: 'White text on the main button' },
  { foreground: '--primary', background: '--surface', minimum: TEXT, stated: 4.59, note: 'Brand name at 14 px bold on phones, and markers' },
  { foreground: '--primary', background: '--nav', minimum: UI, stated: 3.86, note: 'Active marker on the graphite menu' },
  { foreground: '--on-fill', background: '--primary-hover', minimum: TEXT, stated: 5.97, note: 'White text on the hovered button' },
  { foreground: '--primary-ink', background: '--surface', minimum: TEXT, stated: 6.48, note: 'Red as text on white' },
  { foreground: '--primary-ink', background: '--primary-soft', minimum: TEXT, stated: 5.67, note: 'Red as text on its tint' },
  { foreground: '--ink', background: '--surface', minimum: TEXT, stated: 17.74, note: 'Body text on white' },
  { foreground: '--on-fill', background: '--nav', minimum: TEXT, stated: 17.74, note: 'White text on graphite' },
  { foreground: '--ink-2', background: '--surface', minimum: TEXT, stated: 8.43, note: 'Secondary text on white' },
  { foreground: '--ink-3', background: '--surface', minimum: TEXT, stated: 6.17, note: 'Hints on white' },
  { foreground: '--ink-3', background: '--surface-2', minimum: TEXT, stated: 5.33, note: 'Hints on the shaded fill' },
  { foreground: '--border-strong', background: '--surface', minimum: UI, stated: 3.55, note: 'Control edge on white' },
  { foreground: '--border-strong', background: '--bg', minimum: UI, stated: 3.23, note: 'Control edge on the page grey' },
  { foreground: '--nav-ink', background: '--nav', minimum: TEXT, stated: 10.94, note: 'Menu text on graphite' },
  { foreground: '--nav-muted', background: '--nav', minimum: TEXT, stated: 6.56, note: 'Menu group labels on graphite' },
  { foreground: '--accent', background: '--surface', minimum: TEXT, stated: 5.02, note: 'Amber on white' },
  { foreground: '--accent-ink', background: '--accent-soft', minimum: TEXT, stated: 6.92, note: 'Amber ink on its tint' },
  { foreground: '--success', background: '--surface', minimum: TEXT, stated: 5.08, note: 'Success green on white' },
  { foreground: '--danger', background: '--surface', minimum: TEXT, stated: 6.54, note: 'Error red on white' },
  { foreground: '--danger', background: '--danger-soft', minimum: TEXT, stated: 5.74, note: 'Error red on its tint' },
  { foreground: '--info-ink', background: '--info-soft', minimum: TEXT, stated: 9.98, note: 'Neutral notice text on its tint' },
  // Pairs the shell and the shared components use that section 7.3 does not print: held to the minimum only.
  { foreground: '--on-fill', background: '--nav-2', minimum: TEXT, note: 'Active menu item text' },
  { foreground: '--nav-ink', background: '--nav-2', minimum: TEXT, note: 'Menu item text on the hovered row' },
  { foreground: '--ink', background: '--bg', minimum: TEXT, note: 'Body text on the page grey' },
  { foreground: '--ink-2', background: '--surface-2', minimum: TEXT, note: 'Secondary text on the shaded fill' },
  { foreground: '--success-ink', background: '--success-soft', minimum: TEXT, note: 'Success badge and notice text' },
  { foreground: '--danger-ink', background: '--danger-soft', minimum: TEXT, note: 'Error badge and notice text' },
  { foreground: '--accent-ink', background: '--surface', minimum: TEXT, note: 'Amber ink on white' },
  { foreground: '--on-fill', background: '--danger', minimum: TEXT, note: 'White text on the danger button' },
  { foreground: '--on-fill', background: '--success', minimum: TEXT, note: 'White text on a success fill' },
  { foreground: '--on-fill', background: '--accent', minimum: TEXT, note: 'White text on the count badge' },
];
