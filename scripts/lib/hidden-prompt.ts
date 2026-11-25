/**
 * The line prompt of the server command that resets the Admin's password (STORY-01.10 AC-3, AC-4; architecture section 8 "Emergency Admin password reset").
 *
 * `readHiddenLine` reads one line from a console in raw mode and **writes nothing for any key**: no character, no `*`, no length. Backspace edits, Enter ends the
 * line, Ctrl+C (and Ctrl+D, and the end of the input) cancels, and input stops at `MAX_PROMPT_LENGTH` characters (the ceiling of the password's own schema). The raw
 * mode, the listeners and the paused state are put back in a `finally`, on every path: an answer, a cancel, an error of the input, a console that cannot go raw.
 * `readVisibleLine` is the same loop with the typed characters shown, for the word `RESET`.
 *
 * It takes the input and the output as arguments, so a test drives it with a fake console. Nothing is logged, and a typed line is never kept beyond the returned string.
 */

/** The longest line taken (the 1,024 of the password schema); characters after it are dropped without a sound. */
export const MAX_PROMPT_LENGTH = 1024;

/** The operator pressed Ctrl+C or Ctrl+D, or the input ended before a line was finished. The caller stops with nothing changed. */
export class PromptCancelledError extends Error {
  constructor() {
    super('The prompt was cancelled.');
    this.name = 'PromptCancelledError';
  }
}

/** What the prompt needs of a console input: the part of a `tty.ReadStream` it uses. */
export interface PromptInput {
  readonly isRaw?: boolean | undefined;
  setRawMode(mode: boolean): unknown;
  setEncoding(encoding: 'utf8'): unknown;
  resume(): unknown;
  pause(): unknown;
  on(event: 'data', listener: (chunk: string) => void): unknown;
  on(event: 'end', listener: () => void): unknown;
  on(event: 'error', listener: (error: Error) => void): unknown;
  off(event: 'data', listener: (chunk: string) => void): unknown;
  off(event: 'end', listener: () => void): unknown;
  off(event: 'error', listener: (error: Error) => void): unknown;
}

export interface PromptOutput {
  write(text: string): unknown;
}

const ENTER = new Set(['\r', '\n']);
const BACKSPACE = new Set(['\u007f', '\b']);
const CANCEL = new Set(['\u0003', '\u0004']);
const ESCAPE = '\u001b';
const CSI_INTRODUCER = '[';
const SS3_INTRODUCER = 'O';
/** A control sequence ends at a byte from `@` to `~`. */
const isFinalByte = (char: string): boolean => char >= '@' && char <= '~';
const isControl = (char: string): boolean => char < ' ' || char === '\u007f';

type Echo = 'hidden' | 'visible';

function readLine(input: PromptInput, output: PromptOutput, prompt: string, echo: Echo): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const wasRaw = input.isRaw === true;
    // `Array.from` keeps a character outside the basic plane whole, so one Backspace removes one character.
    let typed: string[] = [];
    // 0: plain; 1: after ESC; 2: inside a `ESC [` sequence; 3: the one character after `ESC O` (an arrow or function key).
    let escape: 0 | 1 | 2 | 3 = 0;
    let finished = false;

    const finish = (outcome: () => void): void => {
      if (finished) return;
      finished = true;
      input.off('data', onData);
      input.off('end', onEnd);
      input.off('error', onError);
      try {
        input.setRawMode(wasRaw);
      } finally {
        input.pause();
      }
      outcome();
    };
    const answer = (): void => {
      output.write('\n');
      const line = typed.join('');
      typed = [];
      finish(() => resolve(line));
    };
    const cancel = (): void => {
      output.write('\n');
      typed = [];
      finish(() => reject(new PromptCancelledError()));
    };
    const onEnd = (): void => cancel();
    const onError = (error: Error): void => {
      typed = [];
      finish(() => reject(error));
    };

    function onData(chunk: string): void {
      for (const char of chunk) {
        if (finished) return;
        if (escape === 1) {
          escape = char === CSI_INTRODUCER ? 2 : char === SS3_INTRODUCER ? 3 : 0;
          continue;
        }
        if (escape === 3) {
          escape = 0;
          continue;
        }
        if (escape === 2) {
          if (isFinalByte(char)) escape = 0;
          continue;
        }
        if (char === ESCAPE) {
          escape = 1;
        } else if (CANCEL.has(char)) {
          cancel();
        } else if (ENTER.has(char)) {
          answer();
        } else if (BACKSPACE.has(char)) {
          if (typed.length > 0) {
            typed.pop();
            if (echo === 'visible') output.write('\b \b');
          }
        } else if (!isControl(char) && typed.length < MAX_PROMPT_LENGTH) {
          typed.push(char);
          if (echo === 'visible') output.write(char);
        }
      }
    }

    try {
      output.write(prompt);
      input.setEncoding('utf8');
      input.setRawMode(true);
      input.on('data', onData);
      input.on('end', onEnd);
      input.on('error', onError);
      input.resume();
    } catch (error) {
      try {
        input.setRawMode(wasRaw);
      } catch {
        // The console would not change mode in the first place; the error below is the one to report.
      }
      input.off('data', onData);
      input.off('end', onEnd);
      input.off('error', onError);
      reject(error);
    }
  });
}

/** Reads a line with nothing shown for the keys: for the temporary password and its repeat. */
export function readHiddenLine(input: PromptInput, output: PromptOutput, prompt: string): Promise<string> {
  return readLine(input, output, prompt, 'hidden');
}

/** Reads a line and shows what is typed: for the word `RESET`. */
export function readVisibleLine(input: PromptInput, output: PromptOutput, prompt: string): Promise<string> {
  return readLine(input, output, prompt, 'visible');
}
