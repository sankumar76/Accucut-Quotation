# DEF-148: the part form follows the tree row's revision, so after another actor changes the open part a tree re-read lets the next single-field save overwrite that actor's change with no 409 (Product; Sev-2 provisional; Jira AQP-505, GitHub #838)

| Field | Value |
|-------|-------|
| Story / AC | STORY-05.08 (AQP-316) AC-5 and AC-6: when the part moved on since the person looked (two tabs or two people), nothing is overwritten and nothing typed is dropped |
| Severity | **Sev-2 Major, provisional**, on the test-plan scale (an AC fails; a stored value is lost with no notice). Not Sev-1: one field's value, a narrow window (another actor's change, then a tree re-read, then a save of the same field), no cost value reaches an Engineer and no approved estimate changes. **Re-grade to Sev-1** if the audit trail does not keep the overwritten value or the reproduction shows more than one field overwritten |
| Priority | P2; routed to the hardening window before G8 under CLAUDE.md section 9 rule 3 (not part of #811 or #836) |
| Type | **Product** (found by lane 2; QA read the code path on `master` 46490f27; the end-to-end reproduction has not been run by QA) |
| Status | **Open, 2026-11-27.** Fix proposed by lane 2 (below); not yet authorised or scheduled by master |
| Jira / GitHub | [AQP-505](https://sankumar76.atlassian.net/browse/AQP-505) / [#838](https://github.com/sankumar76/Accucut-Quotation/issues/838) (labels bug, sev-2, ai-delivery; Jira also aiid-DEF-148, agent-qa-engineer, product, data-integrity). Searched first: JQL on `aiid-DEF-148`, `aiid-STORY-05.08` and 'QLT-836-01': only AQP-316 (the story). |
| Found by / date | lane 2, 2026-11-27, while checking #811 against QLT-836-01 (relayed by the orchestrator); logged by qa-engineer |
| Build / commit | `master` 46490f27 (CI 46080843592); the Engineer page on `master` and the Lead island on #811 (same hook) |
| Environment | any; invented data on a throwaway database to reproduce |

## What the code does (QA read, `src/components/features/estimate-workspace/use-part-form.ts`, `usePartValues`)
- Lines 126 to 128: `useEffect(() => { revisionRef.current = part.revision; }, [part.revision]);` sets the revision a save sends to whatever revision the tree row shows, whenever it changes.
- It does not refresh what the form shows (`heldRef`, the values the server held when the form last looked) or the field's conflict state (`conflictRef`).
- Line 340: `send(...)` calls `savePartInputs(estimateId, partId, { revision: revisionRef.current, values: { [fieldId]: value } }, ...)`: one field, with the newer revision. The server accepts a save whose revision matches, so the 409 `PART_CHANGED_CODE` branch (line 341, `reconcile`), which keeps the other actor's value and holds the typed text, is never taken.
- Any tree re-read (`onChanged: tree.readAgain`, an add, a delete or a move) that shows a newer revision for the open part triggers it.

## Steps to Reproduce (proposed; invented data, throwaway database; not yet run by QA)
1. Person A opens a part of a Draft estimate and sees field F.
2. Person B, in another browser, changes F and saves; the part's revision rises.
3. On A's page, cause a tree re-read (add a row, delete a row or move one, so `tree.readAgain` runs).
4. A types a different value in F and leaves the field.

## Expected / Actual
**Expected** (STORY-05.08 AC-5, AC-6): the save is refused with 409 'changed elsewhere'; B's value stays; A's text is held in the conflict state with the notice and its two buttons.
**Actual (as reported by lane 2):** A's value is saved with no 409 and B's value to F is gone, with no notice.

## Suggested fix (lane 2)
The form follows only its own saves' revisions (lines 354 and 479 already set `revisionRef` from its own save results); a tree re-read that shows a different revision for the open part takes the 409 'changed elsewhere' path (the re-read and conflict plan of `reconcile`). Test-first: a unit test of `usePartValues` (a row revision change, then a save of one field, expects the 409 path) and one E2E with two contexts at three widths. No wait, budget or time-out change (DL-404).

## Proof of fix
QA verifies by re-running the new unit and E2E cases and the regression around them (STORY-05.08's conflict cases), at three widths, on the fix PR's run and on the first `master` push after the squash.

## Fix & Verification  _(developer / qa-engineer)_
| Step | By | Date | Ref |
|------|----|------|-----|
| Master's ruling (grade, owner, date) | master | | |
| Fix PR (test-first) | developer (lane 2) | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-505 and GitHub issue #838, created 2026-11-27 and cross-linked; related AQP-316 (STORY-05.08), AQP-1, #811, #836, QLT-836-01; test plan 0.3.151.