# DEF-104: SCR-03 Lead task queue table lacks the Customer, Folder (Open folder, Copy path) and Assigned by columns and the "Subject:" line under the title (conformance; Product; Sev-3; Jira AQP-461, GitHub #754)

| Field | Value |
|-------|-------|
| Story / AC | AQP-298 (STORY-04.02), AQP-390 (CR-01 item 6); SCR-03 Task queue (Lead); the ux-expert's batch 1, item M. The mock-up and spec text quoted below. |
| Severity | **Sev-3, graded by master 2026-11-26 (DL-414 (2), DL-416 (4)).** QA proposed Sev-2 (the ux-expert's word: Major); the AC check and master's grade move it to Sev-3. |
| Priority | P3 (Jira Medium) (labels `sev-3`, `final-review`, `conformance`) |
| Type | **Product** (conformance deviation of the running build from the SCR mock-up) |
| Status | **Open (new), 2026-11-26 (qa-engineer, from the ux-expert's batch 1).** **Graded by master 2026-11-26 (DL-414, DL-416): Sev-3; lane 2.** Open. |
| Jira / GitHub | [AQP-461](https://sankumar76.atlassian.net/browse/AQP-461) / [#754](https://github.com/sankumar76/Accucut-Quotation/issues/754) (labels bug, sev-3, ai-delivery, final-review, conformance; Jira also aiid-DEF-104, agent-qa-engineer). Relates to AQP-1 and the first owning story. Searched first: no earlier Bug for this deviation. |
| Found by / date | The ux-expert (DL-411 conformance check), batch 1, 26 Nov 2026; logged by qa-engineer, 2026-11-26 |
| Build / commit | production build of `master` `e3dc5b0b`, invented data, hands-on at the widths named (the ux-expert's file `qa-batch-1.md`); QA did not run it |
| Environment | the ux-expert's hands-on check, three widths (360, 768, 1366 px) |

## Design (mock-up and spec)
Columns TASK, ENGINEER, CUSTOMER (short name), FOLDER (path, Open folder, Copy path), DEADLINE, STATUS, ASSIGNED BY, and an edit icon; a 'Subject:' line under the title.

## Build (what the ux-expert saw)
Columns TASK, ENGINEER, DEADLINE, STATUS, ACTIONS; no 'Subject:' line.

## Ruling check
No ruling found; master to confirm. **QA proposes Sev-2** (the ux-expert: Major): the Lead cannot see the customer, open or copy the task folder, or see who assigned the task from the queue (workaround: open each task).

**Graded and checked 2026-11-26 (qa-engineer, after DL-414 and DL-416).** **AC check, 26 Nov (DL-414 (2) check): no AC fails; QA's Sev-2 proposal is withdrawn and the grade is Sev-3.** AQP-298 AC-3 names the customer ("Not chosen yet"), the folder path with Copy path (the shared `FolderPath`) and "Assign task" for Lead and Admin. The build shows the Customer, the Folder (with Copy path) and "Assigned by" as lines inside the Task and Engineer cells of the Lead table (`src/components/features/queues/queue-list.tsx:203-238`), not as separate columns. That layout is the DEF-077 fix: DL-357 (A) bound the masters-table rule (UX spec 6.0, OQ-UX-20) to the Lead queue table, with the Actions column kept visible, and the ux-expert named the pattern. **Under DL-414 (1) ("a newer ruling beats an older mock-up") the columns part may be an as-ruled deviation like DEF-093; this is for master to confirm, QA has not closed it.** The "Subject:" line: AQP-390 Dependencies / Risks says "Whether queue and My tasks show customer and subject: default no", so no AC or default requires it. Lane 2 with DEF-103 (one PR).

## Proof (proposed; master and the ux-expert set it)
The screen at the widths named reads as the design above; the hands-on check repeated by the ux-expert on the fix's build; the existing assertions kept; first-load figure stated if the estimate page changes; no cost data on the Engineer view (NFR-002).

## Fix & Verification  _(developer / ux-expert / qa-engineer)_
| Step | By | Date | Ref (commit / test) |
|------|----|------|---------------------|
| Graded (type, severity, lane) | master | 2026-11-26 | DL-414, DL-416: Sev-3, lane 2 |
| Fixed | developer | | |
| Regression test added | developer | | |
| Hands-on check repeated | ux-expert | | |
| Verified | qa-engineer | | |

## Records
Jira Bug AQP-461 and GitHub issue #754, created 2026-11-26 and cross-linked. Related: AQP-1 and the stories above; DEF-089 to DEF-092; DL-409 to DL-412; test plan 0.3.65; graded in DL-414 and DL-416, test plan 0.3.68. Source: the ux-expert's conformance check (DL-411), batch 1, read from `qa-batch-1.md`; none of these is an accepted deviation (the ux-expert read docs/03-ux/rulings and DL-409 to DL-412). QA did not run the build; the ux-expert's severity word is shown beside QA's proposed grade, and master grades.
