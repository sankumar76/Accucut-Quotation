/**
 * WCAG 2.x contrast ratio (https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio), used to prove that every
 * text and background pair of UX spec section 7.3 meets the ratio stated there (STORY-10.02, AC-1).
 */

import { ValidationError } from './errors';

/** A colour that is not written `#RRGGBB`. */
export class ColourParseError extends ValidationError {
  constructor(value: string) {
    super(`Not a #RRGGBB colour: "${value}"`, { code: 'COLOUR_PARSE_FAILED' });
  }
}

const HEX_COLOUR = /^#([0-9a-f]{6})$/i;
const CHANNEL_BASE = 16;
const MAX_CHANNEL = 255;
/** The constants of the WCAG 2.x relative-luminance formula (https://www.w3.org/TR/WCAG22/#dfn-relative-luminance). */
const SRGB = {
  linearThreshold: 0.03928,
  linearDivisor: 12.92,
  gammaOffset: 0.055,
  gammaScale: 1.055,
  gamma: 2.4,
} as const;
const LUMINANCE_WEIGHT = { red: 0.2126, green: 0.7152, blue: 0.0722 } as const;
const LUMINANCE_OFFSET = 0.05;

/** WCAG 2.2 minimum ratios: normal text, and large text or interface parts. */
export const MINIMUM_RATIO = { normalText: 4.5, largeTextOrUi: 3 } as const;

export interface Rgb {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

/** Parses `#RRGGBB`. Other forms (three-digit hex, functional notation, names) are rejected so a typo cannot pass silently. */
export function parseHexColour(value: string): Rgb {
  const match = HEX_COLOUR.exec(value.trim());
  if (match?.[1] === undefined) throw new ColourParseError(value);
  const digits = match[1];
  const channel = (start: number): number => Number.parseInt(digits.slice(start, start + 2), CHANNEL_BASE);
  return { red: channel(0), green: channel(2), blue: channel(4) };
}

function linearChannel(value: number): number {
  const scaled = value / MAX_CHANNEL;
  return scaled <= SRGB.linearThreshold ? scaled / SRGB.linearDivisor : ((scaled + SRGB.gammaOffset) / SRGB.gammaScale) ** SRGB.gamma;
}

/** Relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(colour: Rgb): number {
  return (
    LUMINANCE_WEIGHT.red * linearChannel(colour.red) +
    LUMINANCE_WEIGHT.green * linearChannel(colour.green) +
    LUMINANCE_WEIGHT.blue * linearChannel(colour.blue)
  );
}

/** Contrast ratio between two `#RRGGBB` colours, 1 to 21, in either order. */
export function contrastRatio(first: string, second: string): number {
  const a = relativeLuminance(parseHexColour(first));
  const b = relativeLuminance(parseHexColour(second));
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + LUMINANCE_OFFSET) / (darker + LUMINANCE_OFFSET);
}
