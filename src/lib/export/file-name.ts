import { istIsoDateOf } from '../time';

/**
 * The name of the exported workbook (STORY-07.01 AC-2; FR-071; UX spec SCR-10 "Content"): `Quotation_<Customer>_<TaskId>_<YYYY-MM-DD>.xlsx`.
 *
 * Pure, so the browser and the server could share it, and it is the **only** place the name is made. Every part is cut down to the characters A-Z, a-z, 0-9, underscore and hyphen
 * before it reaches a header, so no customer name (it is typed by an Admin) can carry a quote, a line break, a path separator or any other character into `Content-Disposition`.
 *
 * Reading of the story's "at most 60 characters" (assumption, labelled in the pull request): it limits the **customer part**, which is the only part a person types; the task code and the date are
 * fixed in length, so the whole name is at most 60 + 41 characters.
 */

/** The longest customer part of a file name. */
export const MAX_CUSTOMER_PART = 60;

/** What the customer part is when nothing of the name is left after the clean-up. */
export const CUSTOMER_FALLBACK = 'Customer';

const FILE_NAME_PREFIX = 'Quotation';
const FILE_NAME_EXTENSION = '.xlsx';
const NOT_ALLOWED = /[^A-Za-z0-9_-]/g;

/** `Acme Tools & Dies` becomes `Acme_Tools__Dies`: each space is one underscore, every other character outside A-Z a-z 0-9 _ - is dropped, and at most 60 remain. `Customer` if none do. */
export function customerPart(name: string | null): string {
  const cleaned = (name ?? '').replace(/ /g, '_').replace(NOT_ALLOWED, '').slice(0, MAX_CUSTOMER_PART);
  return cleaned === '' ? CUSTOMER_FALLBACK : cleaned;
}

export interface ExportFileNameInput {
  /** The customer chosen on the estimate, or `null` while none is. */
  readonly customerName: string | null;
  /** The task code, `Q-2026-0001`. It is made by the server and is cleaned in the same way, so a code that held anything else could not break the header. */
  readonly taskCode: string;
  /** The moment of the download: the date in the name is its IST date. */
  readonly now: Date;
}

export function exportFileName({ customerName, taskCode, now }: ExportFileNameInput): string {
  const task = taskCode.replace(NOT_ALLOWED, '');
  return `${FILE_NAME_PREFIX}_${customerPart(customerName)}_${task}_${istIsoDateOf(now)}${FILE_NAME_EXTENSION}`;
}
