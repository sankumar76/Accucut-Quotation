import { EventEmitter } from 'node:events';

import { describe, expect, it } from 'vitest';

import { MAX_PROMPT_LENGTH, PromptCancelledError, readHiddenLine, readVisibleLine } from '../../scripts/lib/hidden-prompt';

/**
 * STORY-01.10 AC-3 and AC-4 (AQP-428; DL-381 (2)): the prompt that reads the temporary password on the server. It echoes no character, no `*` and no length,
 * Backspace edits, Enter ends, Ctrl+C cancels, input stops at 1,024 characters, and the terminal's raw mode is restored on every path. A fake terminal
 * stands in for the console (the real one is exercised once, at the install rehearsal, AC-13).
 */

class FakeTerminal extends EventEmitter {
  isRaw: boolean;
  readonly rawChanges: boolean[] = [];
  paused = false;
  encoding: string | null = null;

  constructor(isRaw = false) {
    super();
    this.isRaw = isRaw;
  }

  setRawMode(mode: boolean): this {
    this.isRaw = mode;
    this.rawChanges.push(mode);
    return this;
  }

  setEncoding(encoding: string): this {
    this.encoding = encoding;
    return this;
  }

  resume(): this {
    this.paused = false;
    return this;
  }

  pause(): this {
    this.paused = true;
    return this;
  }

  type(text: string): void {
    this.emit('data', text);
  }
}

function fakeOutput() {
  const written: string[] = [];
  return { written, write: (text: string): boolean => (written.push(text), true), text: () => written.join('') };
}

const SECRET = 'Invented-Secret-9!';

describe('AC-4: the hidden prompt echoes nothing', () => {
  it('writes the prompt once, writes nothing for any key, and gives back what was typed at Enter', async () => {
    const terminal = new FakeTerminal();
    const output = fakeOutput();
    const result = readHiddenLine(terminal, output, 'Temporary password: ');
    for (const key of SECRET) terminal.type(key);
    expect(output.written).toEqual(['Temporary password: ']);
    terminal.type('\r');
    await expect(result).resolves.toBe(SECRET);
    // Only a line break, so the cursor moves on; no typed character, no `*`, no length.
    expect(output.text()).toBe('Temporary password: \n');
    expect(output.text()).not.toContain(SECRET);
    expect(output.text()).not.toContain('*');
  });

  it('takes a pasted chunk, ends at \\r, \\n or \\r\\n, and ignores what follows the line break in the same chunk', async () => {
    for (const ending of ['\r', '\n', '\r\n']) {
      const terminal = new FakeTerminal();
      const result = readHiddenLine(terminal, fakeOutput(), 'p: ');
      terminal.type(`${SECRET}${ending}ignored-after-enter`);
      await expect(result).resolves.toBe(SECRET);
    }
  });

  it('Backspace (DEL or BS) removes the last character, and on an empty line does nothing', async () => {
    const terminal = new FakeTerminal();
    const output = fakeOutput();
    const result = readHiddenLine(terminal, output, 'p: ');
    terminal.type('\u007f\b');
    terminal.type('abcd');
    terminal.type('\u007f');
    terminal.type('\b');
    terminal.type('x\r');
    await expect(result).resolves.toBe('abx');
    expect(output.text()).toBe('p: \n');
  });

  it('removes a whole character, not half of one, when the last one is outside the basic plane', async () => {
    const terminal = new FakeTerminal();
    const result = readHiddenLine(terminal, fakeOutput(), 'p: ');
    terminal.type('a\u{1F512}\u007fb\r');
    await expect(result).resolves.toBe('ab');
  });

  it('ignores control characters and the escape sequences of the arrow and function keys', async () => {
    const terminal = new FakeTerminal();
    const result = readHiddenLine(terminal, fakeOutput(), 'p: ');
    terminal.type('a\u001b[A\u001b[3~\t\u0001b\r');
    await expect(result).resolves.toBe('ab');
  });

  it('an empty line is an empty answer (the caller refuses it)', async () => {
    const terminal = new FakeTerminal();
    const result = readHiddenLine(terminal, fakeOutput(), 'p: ');
    terminal.type('\r');
    await expect(result).resolves.toBe('');
  });

  it('stops taking characters at 1,024: the rest is dropped, and nothing is written', async () => {
    expect(MAX_PROMPT_LENGTH).toBe(1024);
    const terminal = new FakeTerminal();
    const output = fakeOutput();
    const result = readHiddenLine(terminal, output, 'p: ');
    terminal.type('a'.repeat(1_100));
    terminal.type('b\r');
    const typed = await result;
    expect(typed).toHaveLength(1024);
    expect(typed).toBe('a'.repeat(1024));
    expect(output.text()).toBe('p: \n');
  });
});

describe('AC-4: the terminal mode is restored on every path', () => {
  it('goes raw while reading and back after Enter; listens no more, and pauses the input', async () => {
    const terminal = new FakeTerminal();
    const result = readHiddenLine(terminal, fakeOutput(), 'p: ');
    expect(terminal.isRaw).toBe(true);
    expect(terminal.encoding).toBe('utf8');
    terminal.type('a\r');
    await result;
    expect(terminal.isRaw).toBe(false);
    expect(terminal.rawChanges).toEqual([true, false]);
    expect(terminal.listenerCount('data')).toBe(0);
    expect(terminal.listenerCount('end')).toBe(0);
    expect(terminal.listenerCount('error')).toBe(0);
    expect(terminal.paused).toBe(true);
  });

  it('Ctrl+C rejects with PromptCancelledError, restores the mode, and writes no typed character', async () => {
    const terminal = new FakeTerminal();
    const output = fakeOutput();
    const result = readHiddenLine(terminal, output, 'p: ');
    terminal.type(`${SECRET}\u0003`);
    await expect(result).rejects.toBeInstanceOf(PromptCancelledError);
    expect(terminal.isRaw).toBe(false);
    expect(terminal.listenerCount('data')).toBe(0);
    expect(output.text()).not.toContain(SECRET);
  });

  it('Ctrl+D and the end of the input cancel too', async () => {
    const eof = new FakeTerminal();
    const first = readHiddenLine(eof, fakeOutput(), 'p: ');
    eof.type('\u0004');
    await expect(first).rejects.toBeInstanceOf(PromptCancelledError);
    expect(eof.isRaw).toBe(false);

    const closed = new FakeTerminal();
    const second = readHiddenLine(closed, fakeOutput(), 'p: ');
    closed.emit('end');
    await expect(second).rejects.toBeInstanceOf(PromptCancelledError);
    expect(closed.isRaw).toBe(false);
  });

  it('an error of the input rejects with that error and restores the mode', async () => {
    const terminal = new FakeTerminal();
    const result = readHiddenLine(terminal, fakeOutput(), 'p: ');
    const failure = new Error('the console went away');
    terminal.emit('error', failure);
    await expect(result).rejects.toBe(failure);
    expect(terminal.isRaw).toBe(false);
    expect(terminal.listenerCount('data')).toBe(0);
  });

  it('a console that cannot go raw rejects and leaves nothing listening', async () => {
    const terminal = new FakeTerminal();
    terminal.setRawMode = () => {
      throw new Error('not a terminal');
    };
    await expect(readHiddenLine(terminal, fakeOutput(), 'p: ')).rejects.toThrow('not a terminal');
    expect(terminal.listenerCount('data')).toBe(0);
  });

  it('puts the mode back as it found it: a terminal that was already raw stays raw', async () => {
    const terminal = new FakeTerminal(true);
    const result = readHiddenLine(terminal, fakeOutput(), 'p: ');
    terminal.type('a\r');
    await result;
    expect(terminal.isRaw).toBe(true);
  });

  it('two prompts one after the other each read their own line', async () => {
    const terminal = new FakeTerminal();
    const first = readHiddenLine(terminal, fakeOutput(), 'one: ');
    terminal.type('first\r');
    await expect(first).resolves.toBe('first');
    const second = readHiddenLine(terminal, fakeOutput(), 'two: ');
    terminal.type('second\r');
    await expect(second).resolves.toBe('second');
  });
});

describe('the visible prompt (for the word RESET) shows what is typed', () => {
  it('echoes each character, erases on Backspace, and ends at Enter', async () => {
    const terminal = new FakeTerminal();
    const output = fakeOutput();
    const result = readVisibleLine(terminal, output, 'Type RESET: ');
    terminal.type('RESEX');
    terminal.type('\u007f');
    terminal.type('T\r');
    await expect(result).resolves.toBe('RESET');
    expect(output.text()).toBe('Type RESET: RESEX\b \bT\n');
    expect(terminal.isRaw).toBe(false);
  });

  it('Ctrl+C cancels and restores the mode', async () => {
    const terminal = new FakeTerminal();
    const result = readVisibleLine(terminal, fakeOutput(), 'Type RESET: ');
    terminal.type('\u0003');
    await expect(result).rejects.toBeInstanceOf(PromptCancelledError);
    expect(terminal.isRaw).toBe(false);
  });
});
