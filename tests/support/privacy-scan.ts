import { PLACEHOLDER_PHONE_PATTERN } from './placeholder-pattern';
import { readLines } from './scan-files';

/**
 * The scan behind STORY-10.12 AC-1 and AC-2 (NFR-028, NFR-006): every e-mail address and phone number in a fixture, a seed
 * placeholder, the environment template or a document is an invented one. An e-mail address must be on a domain that is
 * reserved for examples; a phone number must match the invented pattern in `placeholder-pattern.ts`. Anything else is reported
 * with its file and line. The repository is public, so a real person's details must never get in (CLAUDE.md section 6 rule 7).
 *
 * The scan reads text, not meaning: it can say "this looks like an e-mail address", and a person decides whether an odd match
 * is real. A match that is not personal data goes on the one reviewed list in `privacy-fixtures.test.ts`, with a reason.
 */

export type PersonalDataKind = 'email' | 'phone';

export interface PersonalDataFinding {
  readonly file: string;
  /** 1-based, as an editor shows it. */
  readonly line: number;
  readonly kind: PersonalDataKind;
  /** The text that matched, as written. */
  readonly value: string;
}

export interface PrivacyException {
  readonly kind: PersonalDataKind;
  /** The matched text, compared in lower case. */
  readonly value: string;
  /** Why it is not personal data. A list entry without one is a failure of its own. */
  readonly reason: string;
}

/** The top-level domains that RFC 2606 and RFC 6761 reserve, and that no real mailbox can use. */
const RESERVED_TOP_LEVEL_DOMAINS: ReadonlySet<string> = new Set(['test', 'invalid', 'example']);

/** `example.com`, `example.org` and `example.net` themselves and anything below them. */
const RESERVED_EXAMPLE_DOMAIN = /(^|\.)example\.(com|org|net)$/;

/** The local part, `@`, and a domain of at least two labels whose last label is letters only (so `eslint@9.39.5` is not one). */
const EMAIL_ADDRESS = /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})/g;

export function isReservedDomain(domain: string): boolean {
  const lower = domain.toLowerCase();
  const topLevel = lower.slice(lower.lastIndexOf('.') + 1);
  return RESERVED_TOP_LEVEL_DOMAINS.has(topLevel) || RESERVED_EXAMPLE_DOMAIN.test(lower);
}

/** What may not stand next to a phone number for it to be one: a letter, digit, dot, sign or path character means it is part of something else. */
const NOT_BEFORE = String.raw`(?<![\w.+$/#:@-])`;
const NOT_AFTER = String.raw`(?![\w.@-])`;

/** International form: a plus sign and at least eight digits, with spaces, hyphens and brackets between them. */
const INTERNATIONAL_NUMBER = /\+\d[\d ()-]{6,}\d/g;

/**
 * Ten digits starting 6 to 9, the form of an Indian mobile number, written solid or as 5 + 5. Ten bare digits are also what a run
 * ID, a comment ID or a timestamp looks like, and the documents hold hundreds of those, so this form counts only when a word that
 * names a phone stands right before it (`Mobile: `, `phone no. `, `call `). The forms with a plus sign or with groups of digits
 * need no such word. The number is the first group of the match.
 */
const PHONE_LABEL = String.raw`\b(?:phones?|telephone|tel|mobile|mob|whatsapp|cell|msisdn|contact|call)\b`;
const MOBILE_NUMBER = new RegExp(
  String.raw`${PHONE_LABEL}[\s:=\-"'()]{0,6}(?:(?:no|number|num)\b[\s.:=\-"'()]{0,6})?([6-9]\d{4}[ -]?\d{5})${NOT_AFTER}`,
  'gi',
);

/** Digits in three groups (an optional area code in brackets, then two groups of three or four), joined by spaces or hyphens. */
const GROUPED_NUMBER = new RegExp(String.raw`${NOT_BEFORE}\(?\d{3,5}\)?[ -]\d{3,4}[ -]\d{3,4}${NOT_AFTER}`, 'g');

const MIN_INTERNATIONAL_DIGITS = 8;

/** The e-mail addresses on a line that are not on a reserved domain. */
export function findUnreservedEmails(line: string): string[] {
  if (!line.includes('@')) return [];
  return [...line.matchAll(EMAIL_ADDRESS)].filter((match) => !isReservedDomain(match[1] ?? '')).map((match) => match[0]);
}

interface Candidate {
  readonly index: number;
  readonly text: string;
}

/** A cheap test that a line can hold a phone number in any of the three forms; most lines of a document cannot, and skip the slower patterns. */
const MAY_HOLD_PHONE = /\+\d|\d{5}[ -]?\d{5}|\d{3}\)?[ -]\d{3}/;

function candidatesOf(line: string): Candidate[] {
  if (!MAY_HOLD_PHONE.test(line)) return [];
  const found: Candidate[] = [];
  for (const match of line.matchAll(INTERNATIONAL_NUMBER)) {
    if (match[0].replaceAll(/\D/g, '').length >= MIN_INTERNATIONAL_DIGITS) found.push({ index: match.index, text: match[0] });
  }
  for (const match of line.matchAll(MOBILE_NUMBER)) {
    const number = match[1] ?? '';
    found.push({ index: match.index + match[0].length - number.length, text: number });
  }
  for (const match of line.matchAll(GROUPED_NUMBER)) found.push({ index: match.index, text: match[0] });
  // One number can match two forms: keep the first (and so the longest) of any that overlap.
  found.sort((a, b) => a.index - b.index || b.text.length - a.text.length);
  const kept: Candidate[] = [];
  let end = -1;
  for (const candidate of found) {
    if (candidate.index < end) continue;
    kept.push(candidate);
    end = candidate.index + candidate.text.length;
  }
  return kept;
}

/** The phone numbers on a line that do not match the invented pattern. */
export function findUninventedPhones(line: string): string[] {
  return candidatesOf(line)
    .map((candidate) => candidate.text.trim())
    .filter((text) => !PLACEHOLDER_PHONE_PATTERN.test(text));
}

/** Everything in `files` (paths below `root`) that looks like a real e-mail address or phone number, before any exception. */
export function scanForPersonalData(root: string, files: ReadonlyArray<string>): PersonalDataFinding[] {
  const findings: PersonalDataFinding[] = [];
  for (const file of files) {
    for (const [index, text] of readLines(root, file).entries()) {
      const line = index + 1;
      for (const value of findUnreservedEmails(text)) findings.push({ file, line, kind: 'email', value });
      for (const value of findUninventedPhones(text)) findings.push({ file, line, kind: 'phone', value });
    }
  }
  return findings;
}

export function isExcepted(finding: PersonalDataFinding, exceptions: ReadonlyArray<PrivacyException>): boolean {
  return exceptions.some((exception) => exception.kind === finding.kind && exception.value.toLowerCase() === finding.value.toLowerCase());
}

/** One line per finding, `file:line: kind: value`, for a failure message. */
export function describeFindings(findings: ReadonlyArray<PersonalDataFinding>): string {
  return findings.map((finding) => `${finding.file}:${finding.line}: ${finding.kind}: ${finding.value}`).join('\n');
}
