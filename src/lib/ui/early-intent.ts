/**
 * The client side of the early-tap capture (AQP-188 AC-10, DEF-013). A tap on the menu button or the account trigger
 * before React has attached its handlers would be lost, so a small inline script in the page (`early-intent-script.ts`,
 * rendered by the server layout) keeps it: it marks the control pending and records which control was pressed last.
 * When the page becomes interactive, the first-open hook reads that record and treats it as the first activation.
 *
 * This file is in the first load, so it holds only constants and two small functions. The script itself is in a file
 * that only the server layout imports, so its text never reaches the browser's JavaScript.
 */

/** Marks a control that opens an overlay on its first open. The value names the control: `menu` or `account`. */
export const EARLY_INTENT_ATTRIBUTE = 'data-early-intent';

/** The name of the record the script keeps on `window`. */
export const EARLY_INTENT_GLOBAL = '__earlyIntent';

export interface EarlyIntentRecord {
  /** The control pressed last, or `null` when nothing is pending (nothing pressed, or Escape was pressed). */
  readonly id: string | null;
  /** The press was made with the keyboard (Enter or Space: a click without a pointer, `detail` 0). */
  readonly keyboard: boolean;
  /** Stops the script's listeners. */
  readonly stop: () => void;
}

export interface EarlyIntent {
  readonly id: string;
  readonly keyboard: boolean;
}

function recordOf(host: object): EarlyIntentRecord | undefined {
  const value: unknown = Reflect.get(host, EARLY_INTENT_GLOBAL);
  if (typeof value !== 'object' || value === null) return undefined;
  const id: unknown = Reflect.get(value, 'id');
  const stop: unknown = Reflect.get(value, 'stop');
  if (typeof stop !== 'function') return undefined;
  const keyboard: unknown = Reflect.get(value, 'keyboard');
  return { id: typeof id === 'string' ? id : null, keyboard: keyboard === true, stop: () => void Reflect.apply(stop, value, []) };
}

/** The press the script kept for `controlId`, or `undefined` when the person pressed nothing, or another control last. */
export function readEarlyIntent(host: object, controlId: string): EarlyIntent | undefined {
  const record = recordOf(host);
  return record?.id === controlId ? { id: controlId, keyboard: record.keyboard } : undefined;
}

/** Called once, after every control has read its press: the script stops listening and its record is removed. */
export function finishEarlyIntent(host: object): void {
  recordOf(host)?.stop();
  Reflect.deleteProperty(host, EARLY_INTENT_GLOBAL);
}
