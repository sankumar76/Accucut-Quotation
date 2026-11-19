import { describe, expect, it } from 'vitest';

import { applySuggestion, MAX_SUGGESTIONS, suggestionsFor, wordBeforeCaret, type SuggestionSource } from '@/lib/config/formula-suggestions';

/**
 * STORY-08.02 AC-1 and AC-10: what the editor offers while a name is typed, and what choosing one puts in the text. Pure, so the keyboard-only behaviour of the list (arrows, Enter, Escape) is the browser test's
 * and what each choice does to the text is here. Every name is invented or a seed name.
 */

const SOURCE: SuggestionSource = {
  fields: [
    { letter: 'P', label: 'Cutting Time' },
    { letter: 'Q', label: 'Cutting Length' },
    { letter: 'AL', label: 'Cutting Cost' },
    { letter: 'AK', label: 'Material Cost' },
    { letter: 'AM', label: 'Wire Cost' },
  ],
  rateNames: ['Cutting-Rate-per-Sec', 'Plating-rate-per-sqin', 'OH Profit %'],
  operandNames: ['Material-Price-per-kg', 'Material-Specific-Gravity', 'Material-Scrap-Rate', 'ExchangeRate-USD', 'ExchangeRate-EUR'],
};

const offered = (text: string, caret = text.length) => suggestionsFor(wordBeforeCaret(text, caret), SOURCE);

describe('wordBeforeCaret', () => {
  it('finds the name that ends at the caret, hyphens and percent signs included', () => {
    expect(wordBeforeCaret('P * Cutting-Rate', 16)).toEqual({ start: 4, prefix: 'Cutting-Rate' });
    expect(wordBeforeCaret('P * A', 5)).toEqual({ start: 4, prefix: 'A' });
  });

  it('finds nothing after an operator, a bracket or a space', () => {
    for (const text of ['P * ', 'P + (', 'SUM(', 'P ']) expect(wordBeforeCaret(text, text.length)).toBeNull();
  });

  it('reads the word before the caret, not the one after it', () => {
    expect(wordBeforeCaret('Cut * P', 3)).toEqual({ start: 0, prefix: 'Cut' });
  });
});

describe('what is offered', () => {
  it('offers a column letter first when it is typed in full, then the letters that begin with it', () => {
    expect(offered('A').map((suggestion) => suggestion.insert)).toEqual(['AL', 'AK', 'AM']);
    expect(offered('al')[0]).toEqual({ kind: 'field', insert: 'AL', label: 'Cutting Cost' });
  });

  it('finds fields by a word of their name, rates by their start, and says which is which', () => {
    const found = offered('cut');
    expect(found.map((suggestion) => `${suggestion.kind}:${suggestion.insert}`)).toEqual(['field:P', 'field:Q', 'field:AL', 'rate:Cutting-Rate-per-Sec']);
  });

  it('offers the functions, the Material and Exchange operands', () => {
    expect(offered('SU').map((suggestion) => suggestion.insert)).toContain('SUM(');
    expect(offered('Material-Sp')).toEqual([{ kind: 'value', insert: 'Material-Specific-Gravity', label: 'Material-Specific-Gravity' }]);
    expect(offered('Ex').map((suggestion) => suggestion.insert)).toEqual(['ExchangeRate-USD', 'ExchangeRate-EUR']);
  });

  it('offers a rate whose name has spaces and a percent sign by its first word', () => {
    expect(offered('OH')).toEqual([{ kind: 'rate', insert: 'OH Profit %', label: 'OH Profit %' }]);
  });

  it('looks a hyphenated word up again from after each hyphen, so a minus before a name still finds it', () => {
    expect(offered('P-Cutting-R').map((suggestion) => suggestion.insert)).toEqual(['Cutting-Rate-per-Sec']);
    expect(offered('P-Cut').map((suggestion) => suggestion.insert)).toContain('Cutting-Rate-per-Sec');
  });

  it('offers nothing for no word, an unknown word, or a name that is typed in full already', () => {
    expect(offered('P * ')).toEqual([]);
    expect(offered('Zzz')).toEqual([]);
    expect(offered('Cutting-Rate-per-Sec')).toEqual([]);
  });

  it('lists at most eight', () => {
    const many: SuggestionSource = { fields: Array.from({ length: 30 }, (_value, index) => ({ letter: `A${String.fromCharCode(65 + (index % 26))}`, label: `Field ${String(index)}` })), rateNames: [], operandNames: [] };
    expect(suggestionsFor({ start: 0, prefix: 'A' }, many)).toHaveLength(MAX_SUGGESTIONS);
  });
});

describe('what choosing one does to the text', () => {
  it('replaces the word typed so far and puts the caret after the choice', () => {
    const word = wordBeforeCaret('P * Cut', 7);
    const choice = offered('P * Cut').find((suggestion) => suggestion.kind === 'rate');
    if (word === null || choice === undefined) throw new Error('No suggestion.');
    expect(applySuggestion('P * Cut', 7, word, choice)).toEqual({ text: 'P * Cutting-Rate-per-Sec', caret: 24 });
  });

  it('replaces a letter found by a word of its name', () => {
    const word = wordBeforeCaret('P * wire', 8);
    const choice = suggestionsFor(word, SOURCE)[0];
    if (word === null || choice === undefined) throw new Error('No suggestion.');
    expect(applySuggestion('P * wire', 8, word, choice)).toEqual({ text: 'P * AM', caret: 6 });
  });

  it('keeps what follows the caret', () => {
    const text = 'Cut + Q';
    const word = wordBeforeCaret(text, 3);
    const choice = suggestionsFor(word, SOURCE).find((suggestion) => suggestion.insert === 'Cutting-Rate-per-Sec');
    if (word === null || choice === undefined) throw new Error('No suggestion.');
    expect(applySuggestion(text, 3, word, choice)).toEqual({ text: 'Cutting-Rate-per-Sec + Q', caret: 20 });
  });

  it('keeps the minus that sits before a name found after a hyphen', () => {
    const text = 'P-Cut';
    const word = wordBeforeCaret(text, 5);
    const choice = suggestionsFor(word, SOURCE).find((suggestion) => suggestion.insert === 'Cutting-Rate-per-Sec');
    if (word === null || choice === undefined) throw new Error('No suggestion.');
    expect(applySuggestion(text, 5, word, choice)).toEqual({ text: 'P-Cutting-Rate-per-Sec', caret: 22 });
  });

  it('opens the bracket of a function', () => {
    const word = wordBeforeCaret('SU', 2);
    const choice = suggestionsFor(word, SOURCE).find((suggestion) => suggestion.insert === 'SUM(');
    if (word === null || choice === undefined) throw new Error('No suggestion.');
    expect(applySuggestion('SU', 2, word, choice)).toEqual({ text: 'SUM(', caret: 4 });
  });
});
