import { describe, expect, it } from 'vitest';

import { checkIgnore } from '../support/git-ignore';
import { DEFAULT_PROCESS_TIMEOUT_MILLISECONDS, ProcessStartError, assertProcessStarted, runProcess } from '../support/process';

/**
 * DEF-007 (AQP-182): a child process that never started must fail as an error of the test set-up, with its own
 * message, and never be read as the result of the check it was meant to run (a "not ignored" verdict, an exit code).
 */

/** A spawnSync error as Node reports it, with its code. */
function spawnError(code: string): Error {
  return Object.assign(new Error(`spawnSync ${code}`), { code });
}

describe('assertProcessStarted (DEF-007)', () => {
  it('passes a process that ran and exited, whatever its exit code', () => {
    expect(() => assertProcessStarted({ status: 0, signal: null }, 'a check')).not.toThrow();
    expect(() => assertProcessStarted({ status: 1, signal: null }, 'a check')).not.toThrow();
    expect(() => assertProcessStarted({ status: 3, signal: null }, 'a check')).not.toThrow();
  });

  it('refuses a process that could not be started, and names what was being run', () => {
    const error = new Error('spawn ENOMEM');
    expect(() => assertProcessStarted({ status: null, signal: null, error }, 'git check-ignore')).toThrow(ProcessStartError);
    expect(() => assertProcessStarted({ status: null, signal: null, error }, 'git check-ignore')).toThrow(/git check-ignore did not start/);
  });

  it.each([
    // The record's exit code 3221225495 is this one: 0xC0000017.
    ['STATUS_NO_MEMORY (0xC0000017, exit code 3221225495 in the DEF-007 record)', 0xc0000017],
    ['STATUS_DLL_INIT_FAILED (0xC0000142)', 0xc0000142],
    ['STATUS_STACK_BUFFER_OVERRUN (0xC0000409)', 0xc0000409],
  ])('refuses a Windows failure status, %s, rather than report it as an exit code', (_name, status) => {
    expect(() => assertProcessStarted({ status, signal: null }, 'the data-file check')).toThrow(ProcessStartError);
  });

  it('refuses a process killed by a signal', () => {
    expect(() => assertProcessStarted({ status: null, signal: 'SIGKILL' }, 'a check')).toThrow(/ended by SIGKILL/);
  });

  it('QLT-26: refuses a process that reports no exit status and no signal', () => {
    expect(() => assertProcessStarted({ status: null, signal: null }, 'a check')).toThrow(/a check did not report an exit status/);
  });

  it('QLT-28: a process stopped by the time limit gets its own message, not "did not start"', () => {
    const outcome = { status: null, signal: 'SIGTERM' as const, error: spawnError('ETIMEDOUT') };
    expect(() => assertProcessStarted(outcome, 'a check')).toThrow(/a check did not finish within the time limit and was stopped/);
    expect(() => assertProcessStarted(outcome, 'a check')).not.toThrow(/did not start/);
  });

  it('QLT-28: a process stopped for writing too much output gets its own message, not "did not start"', () => {
    const outcome = { status: null, signal: 'SIGTERM' as const, error: spawnError('ENOBUFS') };
    expect(() => assertProcessStarted(outcome, 'a check')).toThrow(/a check wrote more output than the buffer holds and was stopped/);
    expect(() => assertProcessStarted(outcome, 'a check')).not.toThrow(/did not start/);
  });
});

describe('runProcess (DEF-007)', () => {
  it('returns the exit code and the output of a process that ran', () => {
    const result = runProcess(process.execPath, ['-e', "process.stdout.write('out'); process.stderr.write('err'); process.exit(3)"], {
      what: 'a node script',
    });
    expect(result).toEqual({ status: 3, stdout: 'out', stderr: 'err' });
  });

  it('throws ProcessStartError for a program that does not exist, instead of returning a result', () => {
    expect(() => runProcess('aqp-no-such-program-182', [], { what: 'a missing program' })).toThrow(ProcessStartError);
  });

  it('PRF-01: has a default time limit of 60 s', () => {
    expect(DEFAULT_PROCESS_TIMEOUT_MILLISECONDS).toBe(60_000);
  });

  it('PRF-01, QLT-28: a per-call time limit stops a process that hangs, with the time-limit message', () => {
    expect(() =>
      runProcess(process.execPath, ['-e', 'setInterval(() => undefined, 1000)'], { what: 'a hanging script', timeout: 300 }),
    ).toThrow(/a hanging script did not finish within the time limit and was stopped/);
  });

  it('QLT-28: a process that writes past the buffer is stopped with the buffer message', () => {
    expect(() =>
      runProcess(process.execPath, ['-e', "process.stdout.write('x'.repeat(4096))"], { what: 'a chatty script', maxBuffer: 16 }),
    ).toThrow(/a chatty script wrote more output than the buffer holds and was stopped/);
  });
});

describe('checkIgnore (QLT-25)', () => {
  it('reads exit 0 as ignored and exit 1 as not ignored', () => {
    expect(checkIgnore('.env').ignored).toBe(true);
    expect(checkIgnore('README.md').ignored).toBe(false);
  });

  it('QLT-25: throws on any other git exit, such as 128 for a path outside the repository, instead of answering "not ignored"', () => {
    expect(() => checkIgnore('../outside-the-repository.txt')).toThrow(/git check-ignore failed with exit code 128/);
  });
});
