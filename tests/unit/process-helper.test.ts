import { describe, expect, it } from 'vitest';

import { ProcessStartError, assertProcessStarted, runProcess } from '../support/process';

/**
 * DEF-007 (AQP-182): a child process that never started must fail as an error of the test set-up, with its own
 * message, and never be read as the result of the check it was meant to run (a "not ignored" verdict, an exit code).
 */

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
    ['STATUS_NO_MEMORY', 0xc0000017],
    ['STATUS_DLL_INIT_FAILED (exit code 3221225495 in the record)', 3_221_225_495],
    ['STATUS_STACK_BUFFER_OVERRUN', 0xc0000409],
  ])('refuses a Windows failure status, %s, rather than report it as an exit code', (_name, status) => {
    expect(() => assertProcessStarted({ status, signal: null }, 'the data-file check')).toThrow(ProcessStartError);
  });

  it('refuses a process killed by a signal', () => {
    expect(() => assertProcessStarted({ status: null, signal: 'SIGKILL' }, 'a check')).toThrow(/ended by SIGKILL/);
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
});
