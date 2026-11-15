/**
 * A minimal harness for running a React hook with no DOM and no test renderer (the project has no testing library and adds none): `vi.mock('react', ...)` hands the hook this module's `useState`, `useRef`,
 * `useEffect`, `useCallback` and `useMemo`, and `renderHook` runs the hook the way a component would, on demand. A state setter only stores the value; the test calls `render()` for the next result, which is
 * what a re-render would give the component, and effects run after each render when their dependencies changed. It is enough for a hook of values and callbacks (`usePartValues`); it is not React.
 */

interface Slot {
  value: unknown;
  deps?: ReadonlyArray<unknown> | undefined;
  cleanup?: (() => void) | undefined;
}

interface Instance {
  readonly slots: Slot[];
  cursor: number;
  readonly effects: Array<() => void>;
}

let active: Instance | null = null;

function slotFor(initial: () => unknown): Slot {
  if (active === null) throw new Error('A hook was called outside renderHook.');
  const index = active.cursor;
  active.cursor += 1;
  active.slots[index] ??= { value: initial() };
  return active.slots[index];
}

const sameDeps = (before: ReadonlyArray<unknown> | undefined, after: ReadonlyArray<unknown> | undefined): boolean =>
  before !== undefined && after !== undefined && before.length === after.length && before.every((value, index) => Object.is(value, after[index]));

/** What the hook imports from 'react'. */
export const reactHooks = {
  useState<T>(initial: T | (() => T)): [T, (next: T | ((current: T) => T)) => void] {
    const slot = slotFor(() => (typeof initial === 'function' ? (initial as () => T)() : initial));
    const set = (next: T | ((current: T) => T)): void => {
      slot.value = typeof next === 'function' ? (next as (current: T) => T)(slot.value as T) : next;
    };
    return [slot.value as T, set];
  },
  useRef<T>(initial: T): { current: T } {
    return slotFor(() => ({ current: initial })).value as { current: T };
  },
  useEffect(effect: () => void | (() => void), deps?: ReadonlyArray<unknown>): void {
    const slot = slotFor(() => ({}));
    if (sameDeps(slot.deps, deps)) return;
    const instance = active;
    instance?.effects.push(() => {
      slot.cleanup?.();
      slot.cleanup = effect() ?? undefined;
    });
    slot.deps = deps;
  },
  useCallback<T>(callback: T): T {
    return callback;
  },
  useMemo<T>(factory: () => T): T {
    return factory();
  },
};

export interface RenderedHook<R> {
  /** Runs the hook again, then its effects, and answers what it returns now. */
  readonly render: () => R;
  /** Runs every effect's cleanup, as leaving the screen does. */
  readonly unmount: () => void;
}

export function renderHook<P, R>(hook: (props: P) => R, props: P): RenderedHook<R> {
  const instance: Instance = { slots: [], cursor: 0, effects: [] };
  return {
    render() {
      active = instance;
      instance.cursor = 0;
      const result = hook(props);
      active = null;
      for (const effect of instance.effects.splice(0)) effect();
      return result;
    },
    unmount() {
      for (const slot of instance.slots) slot.cleanup?.();
    },
  };
}
