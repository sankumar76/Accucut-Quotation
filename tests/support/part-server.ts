import type { Outcome } from '@/lib/api-client';
import type { PartInputs, SaveInputsRequest } from '@/lib/estimates/form-client';

/**
 * An invented server for one part, for the tests of `usePartValues`: it answers the read of the part and the save of values as the real routes do (a stale revision is 409 PART_CHANGED, a real change raises
 * the revision, a blank removes the value), keeps every save it was sent, and can hold the next save until the test lets it go, so a test can type while a save is in flight. Invented ids and values only.
 */

export const PART_ID = '00000000-0000-4000-8000-0000000000f1';

export interface SentSave {
  readonly revision: number;
  readonly values: Readonly<Record<string, string>>;
}

const state = {
  revision: 1,
  inputs: {} as Record<string, string>,
  sent: [] as SentSave[],
  hold: null as Promise<void> | null,
  churn: false,
};

const view = (): PartInputs => ({ id: PART_ID, revision: state.revision, completeness: 'PARTIAL', inputs: { ...state.inputs }, picture: undefined });

export const partServer = {
  /** Starts again with this part: revision 1, these values, nothing sent. */
  reset(inputs: Record<string, string>): void {
    state.revision = 1;
    state.inputs = { ...inputs };
    state.sent = [];
    state.hold = null;
    state.churn = false;
  },
  /** While on, somebody else saves just before every save of this tab arrives, so every save is refused with 409. */
  churn(on: boolean): void {
    state.churn = on;
  },
  /** Somebody else (another tab) saved these values: the part moves on a revision. */
  changeElsewhere(values: Record<string, string>): void {
    state.inputs = { ...state.inputs, ...values };
    state.revision += 1;
  },
  /** The next save waits until the returned function is called. */
  holdNextSave(): () => void {
    let release: () => void = () => undefined;
    state.hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    return release;
  },
  get sent(): ReadonlyArray<SentSave> {
    return state.sent;
  },
  get inputs(): Readonly<Record<string, string>> {
    return state.inputs;
  },
  get revision(): number {
    return state.revision;
  },
  load: (): Promise<Outcome<PartInputs>> => Promise.resolve({ status: 'ok', value: view() }),
  async save(_estimateId: string, _nodeId: string, request: SaveInputsRequest): Promise<Outcome<PartInputs>> {
    state.sent.push({ revision: request.revision, values: { ...request.values } });
    const held = state.hold;
    state.hold = null;
    if (held !== null) await held;
    if (state.churn) {
      state.inputs = { ...state.inputs, c: '1.00' };
      state.revision += 1;
    }
    if (request.revision !== state.revision) {
      return { status: 'refused', httpStatus: 409, code: 'PART_CHANGED', title: 'This part was changed by someone else.', fields: {}, body: {} };
    }
    const next = { ...state.inputs };
    for (const [fieldId, value] of Object.entries(request.values)) {
      if (value === '') delete next[fieldId];
      else next[fieldId] = value;
    }
    const changed = JSON.stringify(next) !== JSON.stringify(state.inputs);
    state.inputs = next;
    if (changed) state.revision += 1;
    return { status: 'ok', value: view() };
  },
};
