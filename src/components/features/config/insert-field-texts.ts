/**
 * The words of SCR-19 "Insert field" (STORY-08.03; UX spec SCR-19 and its mock-up `docs/03-ux/screens/SCR-19.html`), in one place. The sentences of a refusal (an empty label, an unknown name in a formula, a stale
 * version) are the server's (`src/lib/config/field-insert-words.ts`); what is here is the screen's own: its labels, hints, steps and states. A column letter or a field name is never typed here: it is passed in
 * from the registry. The success and audit words are proposed (assumption A-4) and are the ux-expert's to rule on at the end review.
 */

export const INSERT_TITLE = 'Insert field';
export const INSERT_META_DESCRIPTION = 'Add an input, an output, or an input with its cost column to the quotation worksheet, and see the letter changes before you save.';
export const INSERT_DESCRIPTION = 'Add an input, an output, or an input together with its cost column.';

export const BREADCRUMB_LABEL = 'Breadcrumb';
export const FIELDS_LINK_LABEL = 'Fields and formulas';

export const LOADING_LABEL = 'Loading the insert wizard';
export const LOAD_ERROR_TITLE = 'We could not load the insert wizard';
export const LOAD_RETRY = 'Try again';
export const WIZARD_LOADING_LABEL = 'Loading the steps';
export const WIZARD_FAILED_TITLE = 'We could not load the steps';

export const STEP_NAMES = ['What to add', 'Details', 'Preview and save'] as const;
/** The heading of each step's card, in the order of the steps. */
export const STEP_HEADINGS = ['What do you want to add?', 'Details', 'Preview the letter changes'] as const;
export const stepAnnouncement = (step: number): string => `Step ${String(step)} of ${String(STEP_NAMES.length)}: ${STEP_NAMES[step - 1] ?? ''}`;
export const STEPS_LABEL = 'Steps';

export const NEXT_LABEL = 'Next';
export const BACK_LABEL = 'Back';
export const CANCEL_LABEL = 'Cancel';
export const PREVIEW_LABEL = 'Preview';
export const PREVIEWING_LABEL = 'Working out the letters';
export const SAVING_LABEL = 'Inserting';
export const BACK_TO_FIELDS = 'Back to Fields and formulas';

export const TYPE_LEGEND = 'Type of field';
export const TYPE_OPTIONS = [
  { value: 'input', title: 'Input', text: 'A value the Engineer types. Mandatory and visible to Engineers.' },
  { value: 'output', title: 'Output', text: "A calculated value. Never shown to Engineers. It joins a total only when you edit that total's formula." },
  { value: 'pair', title: 'Input and its cost column', text: 'Both in one step. A preview shows how the letters change before you save.' },
] as const;

export const INPUT_HEADING = 'The input (visible to Engineers)';
export const OUTPUT_HEADING = 'The output (hidden from Engineers)';
export const COST_HEADING = 'Its cost column (hidden from Engineers)';

export const LABEL_LABEL = 'Label';
export const VALUE_TYPE_LABEL = 'Type of value';
export const VALUE_TYPE_NUMBER = 'Number, 2 decimals';
export const VALUE_TYPE_TEXT = 'Text';
export const DEFAULT_LABEL = 'Default value';
export const DEFAULT_HINT = 'Leave empty for no default. Without one, the Engineer must enter a value before Calculate.';
export const AFTER_LABEL = 'Insert after column';
export const AFTER_PLACEHOLDER = 'Choose a column';
export const SECTION_LABEL = 'Section of the Engineer form';
export const SECTION_PLACEHOLDER = 'Choose a section';
export const UNIT_LABEL = 'Unit shown beside the input';
export const HINT_LABEL = 'Hint under the input';
export const WIDTH_LABEL = 'Excel column width';
export const WIDTH_HINT = 'In characters, from 1 to 255.';
export const FORMAT_LABEL = 'Excel number format';
export const FORMAT_PLACEHOLDER = 'Choose a format';
export const VISIBILITY_LABEL = 'When is the input shown to the Engineer?';
export const VISIBILITY_ALWAYS = 'Always';
export const VISIBILITY_WHEN = 'Only when another field has a value';
export const WATCH_LABEL = 'Only when this field has a value';
export const WATCH_PLACEHOLDER = 'Choose a field';

export const STAGE_LABEL = 'Stage in cost details';
export const STAGE_PLACEHOLDER = 'Choose a stage';
export const GROUP_LABEL = 'Sub-heading in the stage';
export const GROUP_NONE = 'No sub-heading';
export const HIDE_ZERO_LABEL = 'Hide the line when this input is 0';
export const HIDE_ZERO_NEVER = 'Never hide';
/** A hidden line is calculated and exported with its own value: that is 0 only when its formula gives 0 when the input is 0 (review SQR-03). */
export const HIDE_ZERO_HINT = 'Hidden lines are still calculated and exported with their calculated value.';
export const HIDE_ZERO_TEXT_NOTE = 'Only a Number input can hide its line.';
export const FORMULA_LABEL = 'Formula';
export const FORMULA_NOTE = 'Type the formula in the letters the worksheet will have after the insert, as in Excel where you insert the column first and then type.';

export const COST_POSITION_LABEL = 'Position of the cost column';
export const COST_POSITION_RIGHT = 'Right after the new input';
export const COST_POSITION_OTHER = 'After another column';
export const COST_AFTER_LABEL = 'Insert the cost column after';

export const LETTERS_HEADING = 'Letters after this insert';
export const LETTERS_REGION_LABEL = 'Letters after this insert, scrollable';
export const LETTERS_WAITING = 'Choose the column to insert after to see the new letters.';
export const LETTERS_LOADING = 'Working out the letters';
export const LETTERS_FAILED = 'The letters could not be worked out. Nothing was changed. The preview in the next step tries again.';
export const lettersNewLine = (letter: string, label: string): string => `${letter} ${label} (new)`;
export const MOVED_NOTHING = 'No later column moves: the new field goes at the end.';

export const NOTICES_TITLE = 'Before you insert';
export const NOTICES = [
  'New inputs are mandatory and visible to Engineers.',
  "New outputs are hidden from Engineers and join a total only when that total's formula is edited.",
  'Approved estimates keep the layout and values they were approved with.',
] as const;

export const errorSummaryTitle = (count: number): string => (count === 1 ? '1 thing needs fixing.' : `${String(count)} things need fixing.`);

export const PREVIEW_REGION_LABEL = 'Letters that change, scrollable';
export const PREVIEW_CAPTION = 'Letters that change';
export const PREVIEW_COLUMNS = { was: 'Was', becomes: 'Becomes', field: 'Field' } as const;
export const PREVIEW_FAILED_TITLE = 'We could not work out the preview';
export const PREVIEW_FAILED_LINE = 'The portal did not answer. Nothing was changed. Try again in a moment.';
export const PREVIEW_NOTE = 'The Excel export uses the new letters for estimates calculated from now on.';
export const previewLead = (names: ReadonlyArray<string>): string => `New fields: ${names.join(' and ')}.`;
export const SAME_RESULTS_LINE = 'Every later field moves; formulas keep working. They show the new letters and give the same results.';
export const NEW_FORMULAS_HEADING = 'The formula of the new output';
export const productCellWords = (from: string, to: string): string => `its cell ${from} to ${to}`;
export const NO_MOVES_LINE = 'The new field goes at the end, so no other column changes its letter.';

export const insertLabel = (count: number): string => (count === 1 ? 'Insert' : `Insert ${String(count)} fields`);

export const SUCCESS_TITLE = 'Inserted';
export const SUCCESS_FOLLOW_UP = 'The Excel export uses the new letters for estimates calculated from now on.';

export const SAVE_UNCONFIRMED_TITLE = 'We could not confirm the insert';
export const SAVE_UNCONFIRMED = 'The portal did not answer, so it is not known whether the fields were inserted. Check Fields and formulas before you try again.';
export const STALE_TITLE = 'The fields and formulas changed while you were inserting';
export const STALE_ACTION = 'Start again';
export const REFUSED_TITLE = 'Nothing was inserted';

/** The number formats the worksheet uses, in words. A format the registry holds that is not listed here is shown as it is. */
export const NUMBER_FORMAT_WORDS: Readonly<Record<string, string>> = {
  '0.00': 'Number, 2 decimals',
  '#,##0.00': 'Money, 2 decimals',
  '0': 'Whole number or flag',
  '@': 'Text',
};
export const formatWords = (format: string): string => NUMBER_FORMAT_WORDS[format] ?? format;
