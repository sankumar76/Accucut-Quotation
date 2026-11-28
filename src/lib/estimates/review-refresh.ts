import type { SaveGate } from './save-gate';

/**
 * When the Lead's and the Admin's review reads itself again after a save (QLT-845-23, QLT-845-32; DL-491). `refresh()` asks for it: it runs `quietMs` later, once, however often it is asked. **It starts nothing while a leave
 * is under way** (the gate's flag, set when the leave dialog opens): the fetch of `router.refresh()` would be in flight when the guard's `go(-n)` lands, and WebKit cancels it. What was waiting, or asked meanwhile, is owed:
 * it runs when the person keeps editing (the flag is cleared and the leave did not go ahead) or after a way out that keeps them on the page, and it is dropped when the leave takes them away. The flag lasts for one leave
 * only, and the gate is one object for the whole session, so the scheduler reads it and never keeps it.
 */
export interface ReviewRefresh {
  readonly refresh: () => void;
  /** The page goes: nothing waits, and nothing is listened to. */
  readonly dispose: () => void;
}

export function createReviewRefresh(gate: SaveGate, run: () => void, quietMs: number): ReviewRefresh {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let owed = false;
  const clear = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const refresh = (): void => {
    clear();
    if (gate.isLeaving()) {
      owed = true;
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      run();
    }, quietMs);
  };
  const stop = gate.subscribeLeaving(() => {
    if (gate.isLeaving()) {
      if (timer !== null) {
        clear();
        owed = true;
      }
      return;
    }
    const wasOwed = owed;
    owed = false;
    if (wasOwed && !gate.isLeaveAway()) refresh();
  });
  return {
    refresh,
    dispose: () => {
      clear();
      owed = false;
      stop();
    },
  };
}
