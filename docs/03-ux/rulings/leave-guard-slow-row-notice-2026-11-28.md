# UX ruling: the input-hold line and the slow-row notice on the part form (AQP-506, #845; master DL-488 (iv), DL-489 (3) (v) and (6))

| Field | Value |
|---|---|
| Author / date | ux-expert, 2026-11-28 |
| Asked by | The orchestrator (Jira AQP-506 comment 13657), for master's DL-489 (5). It does not hold lane 1's push |
| Builds on | My ruling of 28 Nov (AQP-506 comment 13645): `readonly` + `aria-readonly`, never `disabled` or `inert`; `aria-busy` on the form region only; nothing visible before 300 ms; one polite line from 300 ms |
| Read from | DL-488 and DL-489; `ux-spec.md` section 6.0 "States" (Loading, Error (action), Success), the SCR-05 and SCR-06/SCR-07 form blocks, button rules (7.2); `lead-admin-edit-inputs-2026-11-27.md` 3.1 to 3.5; the code on `fix/AQP-506-leave-guard-history` at **b2e4b8f5** (`part-fields.tsx`, `use-input-held.ts`, `estimate-texts.ts`, `field-renderer.tsx`, `estimate-review.tsx`); `ui/alert.tsx`, `shared/notice.tsx`, `ui/button.tsx`, `shared/form-layout.ts` |
| Not seen | **The notice and the moved line are not on the PR yet** (head is still b2e4b8f5, where the line is a `role="status"` `p.sr-only` inside the form). I ruled on text and intended look from the code and the DLs. **No browser run** (the Playwright and DevTools servers did not connect). Per the build-must-match-design rule I check the pushed head when it lands |

## Verdict

Confirmed, with **one required change (R1, Minor, one string)** and **two placement requirements (R2, R3)** that are about where the new region goes in the page. Nothing else changes.

## (a) The words

| Item | Text | Ruling |
|---|---|---|
| Notice | `This row is taking a while to open.` | **Confirmed as is.** Plain, no blame, present tense, one sentence, ends with a full stop (content rules, 6.0) |
| Button | `Stay on this row` | **Confirmed as is.** Sentence case, a verb phrase that says what the person gets (this row stays). No rule in the spec asks otherwise |
| Polite line, 300 ms to 5 s | `Saving the row. You can type again in a moment.` | **R1 (required, Minor): `Opening the row. You can type again in a moment.`** |

**Why R1.** The two messages describe one hold and must use one vocabulary. The notice says the row is *opening*, so the line before it cannot say *saving*. "Saving the row" is also not always true: the hold covers a row address being written and, in the Lead's review (SCR-06/07), a form that is read-only and saves nothing. Spec rule: a screen never says something it does not know (the "Nothing was changed" rule, 6.0 Error rows). "Opening the row" is true in every case that holds the fields. It is one constant, `INPUT_HELD_LINE`, and the only place the old words appear on the branch is `estimate-texts.ts:26` (no test spells them out). It does not hold the push; it can ride in the same head as the notice.

## (b) Component and look

* **`Notice` (`shared/notice.tsx`) with `tone="warn"`**, no title, the sentence as its child. It is the shadcn `Alert` with the app's icon, thick left border and words, so it is never colour alone. The warn tone (clock icon, accent colours) is the spec's tone for "a thing is taking long or needs your attention but nothing is wrong". Not `danger`: nothing has failed, and a danger notice would be `role="alert"` and interrupt.
* **The button is the shared `Button`, `variant="secondary"`, default size**, under the sentence with `mt-s-2`, as the conflict notice does (`CONFLICT_KEEP_MINE`). `type="button"`.
* **No new colour, class or token.** No spinner while it waits: the page is not working, it is waiting, and a spinner would say otherwise.
* **After the press**, a second press does nothing (the full load is already starting). Use the Button's `loading` state **only on the path where the full load really starts**; if the leave dialog opens instead (DL-489 (3) (iii): the gate is not clean), the button stays as it was so the person can press it again after the dialog.
* Test hooks, if wanted: `data-input-held-slow` on the notice and `data-input-held-stay` on the button, beside the existing `data-input-held-line`.

## (c) Where it sits and how it is announced

**R2 (required): one region, in the page flow directly BEFORE the `<form>`, not after it and not inside it.**

```
#row-inputs / the form's column
  <div data-input-held-region>           (no aria-busy; not inside the form)
     <p role="status" data-input-held-line class="sr-only">   (always in the DOM, from first paint)
     <Notice tone="warn"> ... [Stay on this row] </Notice>   (only from 5 s)
  </div>
  <form aria-busy ...>  head, progress, "Last saved", notices, section strip, 8 cards  </form>
```

* **Why before.** The row's title is the first thing in the form, so the notice sits at the top of the same block as the fields it describes, in view when the row link has just scrolled to `#row-inputs`. After the form it would be below all eight cards, off screen on a phone, and a screen reader would reach it last. QLT-845-26's reason for leaving the form (a busy ancestor may hold back updates) is met by being a sibling, not by being the last one.
* **Why the line is invisible.** The line stays visually hidden (`sr-only`). That is the spec's Loading pattern ("a visually hidden 'Loading …' in a polite live region", 6.0) and my ruling of 13645: the sighted person's signal from 300 ms is the shaded read-only fields. So there is **no visual position to get wrong for the line**; only its reading order matters, and "just before the form" is right: it is read, then the row title, then the fields.
* **Announcement.** The polite `role="status"` `p` is the **only** live voice, and it is on the page from first paint, because a live region added with its text already in it is often not spoken. The notice itself carries **no live role** (the warn tone has none by default; do not set one). At 5 s the `p`'s text changes from the line to: **`This row is taking a while to open. Use Stay on this row to load it again.`** This is spoken once, politely; it also tells a screen-reader user a button exists, since focus does not go to it. Nothing is said on release (as before).
* **Focus never moves on its own.** Not to the notice, not to the button, not on appear or on release. The button is the first tab stop of the row's block (it comes before the form), so it is one Shift+Tab from the field the person is in, and it has the Button's visible focus ring (2.4.7, 2.4.11).
* **Reading order check.** Browse mode reads: the hidden line, the notice and its button, then the form title and cards. The sentence is therefore read twice in browse mode at 5 s (once from the line, once from the notice). Accepted: it is a rare, short state, and removing either copy costs the announcement or the visible words.
* **Shift.** The notice enters the flow once, at 5 s, and pushes the form down by its own height (about 56 px from 768 px, about 92 px at 360 px where the button wraps under the text; read from the classes, not measured). I rule this acceptable: it is a one-time change while every field is held, nothing is being typed, and the same block already grows when a lock or conflict notice arrives. On the Lead's page `#review-actions` sits below the two columns and moves by the same amount; it is not a gate and I do not ask for reserved space. When the row's data lands the notice goes and the row replaces it (the region empties with the hold).

## (d) The button's target

* The shared `Button` at its **default size is 44 px high at every pointer** (`h-(--control-h)`, 16 px side padding, label width about 130 px). That meets the asked 24 px with a mouse and 44 px with a coarse pointer, and WCAG 2.5.8, so **no size class, no `icon-row`, no compact variant**, and nothing here follows the 36 px fine-pointer compact rule (that is for fields and tree rows).
* Keyboard: native `<button>`, Enter and Space press it, Tab and Shift+Tab reach it. The press gives the Button's pressed look on the first frame (7.3.1). No shortcut and no Escape.
* Touch: one tap. No press-and-hold, no double-tap.

## (e) 300 ms, 5 s and the two messages

They fit, if the notice **replaces** the line and never sits beside it:

| Time held | Fields | What is said (the one live `p`) | What is seen |
|---|---|---|---|
| under 300 ms | read-only, **no visible change** | nothing | nothing |
| 300 ms to 5 s | read-only, shaded as any read-only field | `Opening the row. You can type again in a moment.` (R1) | the shaded fields; no text |
| 5 s on, held | still read-only; the shade stays | `This row is taking a while to open. Use Stay on this row to load it again.` (the line is replaced, not added) | the warn notice and the button |
| released (data landed, or the button pressed and the page loaded) | editable at once | nothing | the notice goes with the hold |

* The hidden line never says "you can type again in a moment" after 5 s, because after 5 s that sentence stops being a promise the screen can keep. The first line is a promise of seconds; the notice is the honest word that it is longer, with a way out.
* **R3 (required): the notice shows only while the fields are held** (DL-489 (3) (vi): "only while the fields are held"), and goes in the same frame as the hold. It must never stay on screen over an editable form.
* The button does a full load, so nothing typed is lost (nothing could be typed). That is true and is **not** said on screen: saying "nothing is lost" would be a promise about a reload, and the spec words only what the screen knows.

## Accessibility notes (this change)

| Check | Result |
|---|---|
| 1.3.1, 1.3.2 reading order | Region before the form; the hidden line then the notice then the row title |
| 1.4.1 not colour alone | Notice has icon, thick border and words |
| 1.4.3, 1.4.11 contrast | Existing `warn` notice and secondary button tokens, unchanged. The notice's text is already used on `accent-soft` in the app; no new pairing |
| 2.1.1, 2.4.3, 2.4.7, 2.4.11 | Reachable by keyboard; focus does not move; the sticky top bar offset is the existing `scroll-mt` of `#row-inputs`, and the notice is inside the block |
| 2.5.8 target size | 44 px high at every pointer |
| 3.3 plain words | Two sentences, no blame, no jargon (no "write", "guard", "RSC") |
| 4.1.3 status messages | One persistent `role="status"` line, outside `aria-busy`; no `alert`; notice has no live role |
| `prefers-reduced-motion` | The notice has no animation; none is added |

## What lane 1 does (one head, no hold on the push)

1. **R1:** `INPUT_HELD_LINE` becomes `Opening the row. You can type again in a moment.`
2. Add `INPUT_HELD_SLOW = 'This row is taking a while to open.'`, `INPUT_HELD_STAY = 'Stay on this row'`, and the spoken text for the live `p` at 5 s (`This row is taking a while to open. Use Stay on this row to load it again.`).
3. **R2:** the region is one wrapper placed directly before the `<form>` (a fragment or a wrapper with the form column's own classes; the form keeps `aria-busy`, the wrapper has none). The `p[data-input-held-line]` is in it from first paint.
4. **R3:** the notice shows only while `held` is true and the 5 s mark has passed, and is built from `Notice tone="warn"` and `Button variant="secondary"` as in (b).
5. Focus is never moved. The button never releases the hold first (DL-489 (3) (vi)).

## For the spec

Add under SCR-05's States (and by reference SCR-06/07) a row "Row slow to open": the words in (a), the warn notice with the button, placed before the form, polite line replaced at 5 s. I fold it into the next spec version; I did not edit `ux-spec.md` in this run, to keep the change to this one note.

## Check when the head lands

At the pushed head, at 360, 768 and 1366 px: the line text is as in R1; the region is before the form and the form alone has `aria-busy`; at 5 s the notice and the button show, are not live regions, and focus has not moved; the button is 44 px; the notice goes when the hold ends; no notice over an editable form.
