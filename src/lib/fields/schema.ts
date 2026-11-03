import { z } from 'zod';

import { ValidationError } from '../errors';

import { collectDocumentIssues } from './document-rules';
import { fieldSchema, sectionSchema, stageSchema } from './field-schema';

export type {
  AutoFieldDefinition,
  FieldDefinition,
  InputFieldDefinition,
  OutputFieldDefinition,
  SectionDefinition,
  StageDefinition,
  VisibleWhen,
} from './field-schema';

/**
 * The configuration document: one validated JSON value per version (ADR-004, architecture section 4.5).
 * A version stores exactly this; a change is a pure function from one document to the next, followed by
 * `parseConfigDocument` on the result.
 */
export const configDocumentSchema = z
  .strictObject({
    sections: z.array(sectionSchema).min(1),
    stages: z.array(stageSchema),
    fields: z.array(fieldSchema).min(1),
  })
  .superRefine((document, context) => {
    for (const { path, message } of collectDocumentIssues(document)) {
      context.addIssue({ code: 'custom', path: [...path], message });
    }
  });

export type ConfigDocument = z.infer<typeof configDocumentSchema>;

/** The most problems listed in an error message. The rest are counted. */
const MAX_LISTED_ISSUES = 5;

/**
 * A document that failed validation. The message names the paths and the rules that failed, never a
 * value: a formula is Restricted data and an error may reach a log (architecture section 5.3).
 */
export class ConfigDocumentError extends ValidationError {
  readonly issues: ReadonlyArray<{ readonly path: string; readonly message: string }>;

  constructor(issues: ReadonlyArray<{ readonly path: string; readonly message: string }>) {
    const listed = issues
      .slice(0, MAX_LISTED_ISSUES)
      .map((issue) => `${issue.path}: ${issue.message}`)
      .join('; ');
    const more = issues.length > MAX_LISTED_ISSUES ? ` (and ${issues.length - MAX_LISTED_ISSUES} more)` : '';
    super(`The configuration document is not valid. ${listed}${more}`, { code: 'CONFIG_DOCUMENT_INVALID' });
    this.issues = issues;
  }
}

/** Validates `input` and returns it typed, or throws `ConfigDocumentError`. Nothing is stored here. */
export function parseConfigDocument(input: unknown): ConfigDocument {
  const result = configDocumentSchema.safeParse(input);
  if (result.success) return result.data;
  throw new ConfigDocumentError(
    result.error.issues.map((issue) => ({ path: issue.path.join('.') || '(document)', message: issue.message })),
  );
}
