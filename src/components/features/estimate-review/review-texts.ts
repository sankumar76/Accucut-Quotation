/**
 * The words of SCR-06 "Estimate review" (STORY-06.02; UX spec SCR-06 "Content", "States", UX-02, UX-26, UX-53). They are written here, in the one place the review is built from, and never in
 * `estimate-texts.ts`, which the Engineer's first load carries whole: nothing in this folder reaches an Engineer (NFR-002; `tests/unit/estimate-review-architecture.test.ts`). A letter in a
 * sentence (BL, BG, H) is always a parameter, taken from the configuration version the figures belong to (FR-021, UX-26), never typed.
 */

export const REVIEW_CUSTOMER_LABEL = 'Customer';
export const REVIEW_NO_CUSTOMER = 'Not chosen yet';

/** The three tiles: the plain name, and the letter tag and file cell beside it. */
export const TILES_LABEL = 'Totals';
export const BL_NAME = 'Total Unit Production Price';
export const BN_NAME = 'Price per Tool Cost';
export const BN_HINT = (totalLetter: string): string => `${totalLetter} divided by the total Tool Cost`;
export const BO_NAME = 'Approved Quote Price';
export const fileCell = (letter: string): string => `File cell ${letter}2`;

/** What a tile or a row shows when it has no figure to show. */
export const NOT_CALCULATED = 'Not calculated';
export const CLEARED = 'Cleared';
export const APPROVED_NOT_SET = 'Not set yet';
export const APPROVED_NOT_SET_HINT = 'You set it when you approve.';
export const APPROVED_NOT_SET_CLEARED_HINT = 'You set it when you approve, after Recalculate.';
export const BN_CLEARED_HINT = 'Cleared with the total.';
/** The line under BL while the figures are cleared (ux-spec v0.29, "BL tile line when cleared", final words from STORY-06.04). */
export const BL_CLEARED_HINT = 'An input changed, so every calculated figure is cleared. Press Recalculate to see them again.';
export const noToolCost = (letter: string): string => `No Tool Cost entered on any part, so there is nothing to divide by. File cell ${letter}2 is left empty.`;

/**
 * The notices of the two states without a figure (SCR-06 "Not calculated" and "Total cleared"); both are live regions (`role="status"`). The words are the final ones of ux-spec v0.29 "SCR-06 interim and final words"
 * (STORY-06.04 AC-10): the button they name now works, so they say so. The not-calculated notice is exactly two sentences (the 0.28 third sentence is withdrawn: the two disabled buttons say it in their reasons).
 */
export const NOT_CALCULATED_NOTICE = 'The Engineer has not calculated this estimate yet. Press Calculate to see costs.';
export const CLEARED_NOTICE_TITLE = 'The total is cleared because an input changed.';
export const CLEARED_NOTICE_BODY =
  'Every calculated figure, on every row, is cleared with it. They show again after you press Recalculate. Until then Approve and lock and the Excel download stay off.';

/** The parts tree (UX-53, UX-29). */
export const TREE_TITLE = 'Parts tree';
export const TREE_PART_NAME = 'Part';
export const COUNT_HIDDEN_LABEL = 'Count for the whole order';
export const COUNT_UNIT = 'nos';
export const TREE_CLEARED_LINE = 'Every calculated figure is cleared because an input changed. Press Recalculate to see them again.';
export const TREE_EMPTY = 'No parts yet.';
/** The link on each row to SCR-07 (STORY-06.03): its words, with the row named for a screen reader beside it. */
export const COST_DETAILS_LINK = 'View cost details';
export const treeLegend = (unitPriceLetter: string, countName: string): string =>
  `Each figure is that row's own ${unitPriceLetter}. The count for the whole order (${countName}) is shown beside it and is already included. The estimate total adds every row's ${unitPriceLetter}.`;
export const COUNT_FIELD_NAME = 'QTY per Assy';
export const rowCurrencies = (usd: string, eur: string): string => `In US dollars $ ${usd}, in euros € ${eur}`;

/** "How the total is built" (AC-3, UX-02). */
export const BUILD_TITLE = (unitPriceLetter: string): string => `How the total is built (the ${unitPriceLetter} of every row added up)`;
export const BUILD_REGION_LABEL = 'How the total is built, scrollable';
export const BUILD_CAPTION = 'One line for each row, with its count and its own figure, ending with the total';
export const BUILD_HEAD_SL_NO = 'Sl. No';
export const BUILD_HEAD_PART = 'Part';
export const BUILD_TOTAL_LABEL = (unitPriceLetter: string): string => `Total (the sum of the ${unitPriceLetter} column)`;
export const BUILD_EXAMPLE =
  'Worked example: if one lid costs 1, one pipe costs 1 and the frame row holds nothing, the total is 24 + 6 + 0 = 30.';
export const ROUNDING_SENTENCE =
  'Figures are shown to 2 decimals. Totals add the unrounded values and round once, so adding the shown figures by hand can differ by a few hundredths.';

/** The bar (AC-6). The first reason of each button is its words for `aria-describedby`. */
export const ACTIONS_LABEL = 'Actions';
export const CALCULATE_LABEL = 'Calculate';
export const RECALCULATE_LABEL = 'Recalculate';
export const APPROVE_LABEL = 'Approve and lock';
export const DOWNLOAD_LABEL = 'Download .xlsx';
/** What the control says while a press is under way (a polite live line, read by a screen reader), and when no usable answer came (STORY-06.04; UX spec SCR-06 "Loading" and "Error"). */
export const CALCULATING_LINE = 'Calculating. This takes a moment.';
export const CALCULATE_FAILED = 'We could not calculate this estimate. Nothing was changed. Try again.';
export const APPROVE_NOT_CALCULATED_REASON = 'Calculate first. Approving is available once the figures have been calculated.';
export const APPROVE_CLEARED_REASON = 'Recalculate first. Approving is available once the figures have been calculated again.';
/** A Draft with current figures (an estimate that was unlocked, STORY-06.08): the third of the reasons Approve and lock is off, ruled in ux-spec v0.31 (SCR-06, SCR-08 and SCR-16 words, ruling 3). The way on is Recalculate. */
export const APPROVE_DRAFT_REASON = 'Recalculate first. Approving is available once this Draft has been calculated again.';
/** The line under the button when the dialog's code did not arrive (the shared first-open failure line; the wording follows "The parts tree did not open." of SCR-05, assumption A-4 of STORY-06.06). */
export const APPROVE_FIRST_OPEN_FAILED = 'The approval window did not open. Check your connection and try again.';
/** Unlock replaces Approve once an estimate is approved (STORY-06.06 AC-5); it opens the dialog of SCR-09 (STORY-06.08). */
export const UNLOCK_LABEL = 'Unlock';
/** The line under the button when the dialog's code did not arrive (the shared first-open failure line, as the approval window's; assumption of STORY-06.08). */
export const UNLOCK_FIRST_OPEN_FAILED = 'The unlock window did not open. Check your connection and try again.';

/**
 * The Approved state of SCR-06 (STORY-06.06 AC-5; UX spec SCR-06 "Approved (Lead)" and the G3 screen): the notice with the approver and the time, and the two sentences the spec gives for what approval means.
 * `time` is written in IST (`formatIst`). A notice for an approved estimate with no approvals row (data made before approvals existed) says only that it is approved and locked.
 */
export const approvedNoticeTitle = (time: string, name: string): string => `Approved and locked on ${time} by ${name}.`;
export const APPROVED_NOTICE_TITLE_PLAIN = 'Approved and locked.';
export const APPROVED_NOTICE_BODY = 'Locked. Values stay as approved even if rates change later. Only the Admin can cancel an approval.';
/** The line under BO once approved: "Approved by Kiran Bose, 05 Nov 2026, 11:20 IST." (the tile adds "File cell BO2." itself). */
export const approvedByLine = (name: string, time: string): string => `Approved by ${name}, ${time}.`;

/**
 * An estimate that was unlocked (STORY-06.08 AC-3, AC-12; UX spec SCR-06 "Draft after unlock", UX-59, the SCR-09 mock-up): BO is the price approved earlier, labelled so, until a new approval replaces it. It is the approvals row's
 * price whatever the state of the figures, so clearing them never changes it.
 */
export const APPROVED_EARLIER_LABEL = 'Approved earlier';
export const APPROVED_EARLIER_STAYS = 'It stays until a new approval replaces it.';

/**
 * The notice of an unlocked Draft (STORY-06.08 AC-3; UX spec SCR-06 states "Draft after unlock" and "Unlocked and changed"): who, when and why, what the figures are, the price approved earlier, and whose queue the task is back in.
 * `time` is written in IST (`formatIst`). The words of the figures follow the state: current (nothing changed since), or cleared (an input has changed since). The reason is the Lead's own text.
 */
export const unlockedNoticeTitle = (time: string, name: string): string => `Unlocked on ${time} by ${name}.`;
export const unlockedReasonLine = (reason: string | null): string => (reason === null ? '' : `Reason: ${reason}`);
export const UNLOCKED_FIGURES_CURRENT = 'The figures below are still the ones from the approval. As soon as you change an input every calculated figure is cleared. Recalculate to bring them up to date.';
export const UNLOCKED_FIGURES_CLEARED = 'An input has changed since, so every calculated figure is cleared. Recalculate to bring them up to date.';
export const UNLOCKED_PRICE_STAYS = 'The price approved earlier stays until a new approval replaces it.';
export const unlockedQueueLine = (engineerName: string): string => `The task is back in ${engineerName}'s Open queue.`;
export const DOWNLOAD_NOT_CALCULATED_REASON = 'Calculate or Recalculate first. There is no file until a calculation is current.';
export const DOWNLOAD_NOT_YET_REASON = 'The Excel download is not available yet.';
export const calculatedLine = (at: string, configurationNumber: number): string => `Calculated ${at} · configuration version ${configurationNumber}`;
