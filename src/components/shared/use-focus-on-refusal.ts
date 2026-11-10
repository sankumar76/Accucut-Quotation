import { useEffect, useEffectEvent, useState } from 'react';

/**
 * Shows the messages of a refusal and moves focus to the first field that has one (UX spec section 6.0 "Forms"). Focus moves then, and only then.
 * Typing in a field removes that field's message, which makes a new `errors` object, so an effect keyed on the errors would run again after
 * every key and send focus to the next refused field while the person is still typing (DEF-024 to DEF-026; the same fault was QLT-01 of
 * AQP-123). A form calls the returned function with the messages of a refusal, from its submit and from the server's answer, and nowhere else;
 * typing only clears a message with its own `setErrors`.
 *
 * `order` is the fields in the order of the form; `focusField` puts focus on one field (by id, by ref, ...); `setErrors` stores the messages.
 * Each call makes a new request, so a second refusal of the same field moves focus there again.
 */
export function useFocusOnRefusal<TField extends string>(
  order: ReadonlyArray<TField>,
  focusField: (field: TField) => void,
  setErrors: (errors: Readonly<Partial<Record<TField, string>>>) => void,
): (errors: Readonly<Partial<Record<TField, string>>>) => void {
  const [request, setRequest] = useState<{ readonly field: TField } | null>(null);
  const focus = useEffectEvent(focusField);

  useEffect(() => {
    if (request !== null) focus(request.field);
  }, [request]);

  return (errors) => {
    setErrors(errors);
    const first = [...order].reverse().find((field) => errors[field] !== undefined);
    if (first !== undefined) setRequest({ field: first });
  };
}
