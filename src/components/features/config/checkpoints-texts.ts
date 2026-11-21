/**
 * The words of SCR-21 "Checkpoints and versions" (STORY-08.06; UX spec SCR-21 and its mock-up), in one place. The sentences the server decides (a name that is taken or missing, a wrong password, a block, a version that
 * moved on, a target that cannot be used) are the server's and are shown as they come; what is here is the screen's own: its title, its labels, its states and the revert dialog's text. A version number or a name is
 * never typed here: it is passed in. The words marked proposed in the story are the ux-expert's to rule on at the end review.
 */

export const CHECKPOINTS_TITLE = 'Checkpoints and versions';
export const CHECKPOINTS_META_DESCRIPTION = 'Save named checkpoints of the worksheet configuration and revert to one.';
export const CHECKPOINTS_DESCRIPTION = 'Save the field and formula configuration under a name, and go back to it later. Checkpoints never touch estimate data.';

/** The current version card. */
export const CURRENT_TITLE = 'Current configuration';
export const CURRENT_LOADING_LABEL = 'Loading the current configuration';
export const SEED_SAVED_BY = 'Original configuration';

/** `3 estimates` / `1 estimate`: the count of estimates whose current calculation was worked out with the current version. */
export const estimatesInUseLine = (count: number): string => (count === 1 ? '1 estimate' : `${String(count)} estimates`);

/** The save form. */
export const SAVE_LABEL = 'Save as a checkpoint';
export const SAVE_PLACEHOLDER = 'Name, for example Before AY insert';
export const SAVE_HINT = 'A checkpoint names the configuration as it is now. It never changes an estimate.';
export const SAVE_BUTTON = 'Save checkpoint';
export const SAVING_BUTTON = 'Saving';
export const savedNotice = (name: string): string => `Checkpoint "${name}" saved.`;
export const SAVED_TITLE = 'Saved';
export const SAVE_UNCONFIRMED = 'The portal did not answer, so it is not known whether the checkpoint was saved. Look at the list before you try again.';

/** The list. */
export const LIST_TITLE = 'Saved checkpoints';
export const TABLE_CAPTION = 'Saved checkpoints';
export const TABLE_REGION_LABEL = 'Saved checkpoints, scrollable';
export const CARDS_LABEL = 'Saved checkpoints';
export const LOADING_LABEL = 'Loading checkpoints';
export const EMPTY_TITLE = 'No checkpoints yet';
export const EMPTY_DESCRIPTION = 'Save one before you change formulas, so you can go back.';
export const ERROR_TITLE = 'We could not load the checkpoints';
export const ERROR_RETRY = 'Try again';
export const CURRENT_VERSION_TAG = 'Current';
export const REVERT_ROW_LABEL = 'Revert';

/** The success notice after a revert, and its undo (AC-7). */
export const REVERTED_TITLE = 'Reverted';
export const UNDO_LABEL = 'Revert to the version from before';
export const DIALOG_FAILED_LINE = 'The revert window did not open. Check your connection and try again.';

/** The revert dialog (AC-10): what happens, in four sentences, and the password. */
export const revertTitle = (name: string | null, versionNumber: number): string => (name === null ? `Revert to version ${String(versionNumber)}?` : `Revert to "${name}"?`);
export const revertLead = (versionNumber: number, newNumber: number): string =>
  `This makes a new configuration version (version ${String(newNumber)}) that is a copy of version ${String(versionNumber)}.`;
export const REVERT_EFFECTS: ReadonlyArray<string> = [
  'Estimate data is not touched.',
  'Approved estimates keep the layout and values they were approved with.',
  'A draft estimate uses the reverted layout from its next calculation.',
  'You can undo it: the version you are on now stays in the history.',
];
export const REVERT_EFFECTS_LABEL = 'What a revert does';
export const PASSWORD_LABEL = 'Your password';
export const PASSWORD_HINT = 'The password you sign in with. A revert is checked with it each time.';
export const KEEP_LABEL = 'Keep the current version';
export const CLOSE_LABEL = 'Close';
export const REVERT_LABEL = 'Revert';
export const REVERTING_LABEL = 'Reverting';
export const REVERT_UNCONFIRMED = 'The portal did not answer, so it is not known whether the revert went through. Look at the current configuration before you try again.';
