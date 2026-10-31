---
name: gate-check
description: Ask the master agent for a formal quality-gate decision (G0-G8) on the current artefacts and record it.
argument-hint: "<gate, e.g. G3> [story-id for G5-G7]"
disable-model-invocation: true
---

# Gate Check

Gate requested: **$ARGUMENTS**

1. From `CLAUDE.md` §3, list the entry artefacts for this gate and verify each exists
   (for story gates, under the given story ID).
2. Delegate to `master` with: the gate ID, every artefact path, and any exceptions or
   human decisions already known.
3. Relay master's decision to the user verbatim in summary form: decision, failed checks
   with evidence, remediation actions with owner agents.
4. Confirm the decision was appended to `docs/00-governance/gate-log.md` and reflected in
   `docs/project-state.md`. For **G8**, ask the user for explicit release sign-off and
   record their answer in the gate log entry.
