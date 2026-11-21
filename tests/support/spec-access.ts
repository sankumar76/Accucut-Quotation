import type { RoleName } from '../../src/lib/auth/roles';

/**
 * What SPEC sections 3 and 9 say about who may open each screen and call each API route, written out by hand (not read from the manifest), so the role
 * matrix compares the manifest with the SPEC and not with itself. Kept apart from `tests/security/role-matrix.test.ts`, which is at its line limit.
 */

/** What SPEC sections 3 and 9 say, written out (screen, then who may open it). A key may start with the method (`GET /api/v1/tasks`) where the methods of one path differ. */
export const SPEC_ACCESS: Readonly<Record<string, ReadonlyArray<RoleName>>> = {
  '/queue': ['ADMIN', 'LEAD', 'ENGINEER'], // Dashboard and task queues: all (an Engineer sees their own)
  '/assign': ['ADMIN', 'LEAD'], // Assign task
  '/estimates/[code]': ['ADMIN', 'LEAD', 'ENGINEER'], // Estimate workspace: all, role-filtered
  '/estimates/[code]/costs/[slNo]': ['ADMIN', 'LEAD'], // Cost details
  '/estimates/[code]/export': ['ADMIN', 'LEAD'], // Excel export (FR-070)
  '/masters/process': ['ADMIN'], // Masters
  '/masters/customers': ['ADMIN'],
  '/masters/customers/[id]': ['ADMIN'], // SCR-12, the edit page
  '/masters/materials': ['ADMIN'],
  '/config/fields': ['ADMIN', 'LEAD'], // Field and formula configuration: Admin edits, Lead views
  '/config/fields/[id]/formula': ['ADMIN'], // SCR-18, the formula editor: the Admin edits (STORY-08.02, NFR-001)
  '/config/fields/new': ['ADMIN'], // SCR-19, insert a field: the Admin alone (STORY-08.03 AC-1, NFR-001)
  '/config/checkpoints': ['ADMIN'], // Insert and delete fields, checkpoints: Admin
  '/users': ['ADMIN'], // Users
  '/settings': ['ADMIN'], // Settings
  '/audit': ['ADMIN'], // Audit log
  '/about': ['ADMIN', 'LEAD', 'ENGINEER'], // About: all
  // The API behind the Users screen (SPEC section 9: Users is the Admin's; architecture section 6 rows "Users" and "Reset user password").
  '/api/v1/users': ['ADMIN'],
  '/api/v1/users/[id]': ['ADMIN'],
  '/api/v1/users/[id]/password-reset': ['ADMIN'],
  '/api/v1/users/[id]/admin-handover': ['ADMIN'], // Hand over Admin (STORY-01.09; architecture section 6 "Hand over Admin": A, step-up)
  // The API behind the Audit log screen (SPEC section 9: the audit log is the Admin's; architecture section 6 row "Audit", CR-33).
  '/api/v1/audit': ['ADMIN'],
  // The API behind Settings (SPEC section 9: Settings is the Admin's; architecture section 6 row "Settings", STORY-02.09 AC-6, CR-33).
  '/api/v1/settings': ['ADMIN'],
  // STORY-09.02: the test e-mail goes to the Admin's own address, and only the Admin may ask for it (architecture section 6 row "Test e-mail", AC-6).
  '/api/v1/settings/test-email': ['ADMIN'],
  // The API behind Fields and formulas (STORY-08.01; architecture section 6 row "Configuration": A L): the Admin and the Lead read the formulas, an Engineer never does (NFR-002, CR-33).
  // Two rows, one per method, because the roles differ (STORY-08.03): the read is the Admin's and the Lead's, the insert is the Admin's alone.
  'GET /api/v1/config/fields': ['ADMIN', 'LEAD'],
  'POST /api/v1/config/fields': ['ADMIN'],
  '/api/v1/config/current': ['ADMIN', 'LEAD'],
  // The formula editor's three routes (STORY-08.02 AC-7; architecture section 6 rows "Formula check", "Sample rows", "Save formula": A): the Admin alone.
  '/api/v1/config/formula-check': ['ADMIN'],
  '/api/v1/config/sample-rows': ['ADMIN'],
  '/api/v1/config/fields/[id]/formula': ['ADMIN'],
  // The insert wizard's routes (STORY-08.03 AC-1; architecture section 6 rows "Insert preview" and "Insert field": A): the Admin alone. `insert-options` is the third route (a deviation recorded in the PR).
  '/api/v1/config/fields/preview': ['ADMIN'],
  '/api/v1/config/insert-options': ['ADMIN'],
  // The delete dialog's two routes (STORY-08.04 AC-1; architecture section 6 row "Delete field": A, with the password; the references read is the dialog's own): the Admin alone.
  '/api/v1/config/fields/[id]': ['ADMIN'],
  '/api/v1/config/fields/[id]/references': ['ADMIN'],
  // The checkpoint and revert routes (STORY-08.06 AC-9; architecture section 6 rows "Checkpoints" and "Revert": A, the revert with the password): the Admin alone.
  '/api/v1/config/checkpoints': ['ADMIN'],
  '/api/v1/config/versions/[id]/revert': ['ADMIN'],
  // The API behind the Process master screen (SPEC section 9: masters are the Admin's, BR-004; architecture section 6 row "Process items", CR-33).
  '/api/v1/process-items': ['ADMIN'],
  '/api/v1/process-items/[id]': ['ADMIN'],
  '/api/v1/materials': ['ADMIN'], // the Materials tab of SCR-13: masters are the Admin's (BR-004), CR-33
  '/api/v1/materials/[id]': ['ADMIN'],
  '/api/v1/exchange-rates': ['ADMIN'], // the Exchange rates tab (STORY-02.04): the Admin's alone; an Engineer never receives a rate (BR-003)
  '/api/v1/treatments': ['ADMIN'], // the Treatment / Color tab (STORY-02.05): the Admin's alone (BR-004); an Engineer reads only the options list
  '/api/v1/treatments/[id]': ['ADMIN'],
  '/api/v1/customers': ['ADMIN'], // SCR-12 (STORY-02.02): the Admin's alone (BR-004); an Engineer reads only the options list (names, no contact detail or rate)
  '/api/v1/customers/[id]': ['ADMIN'],
  '/api/v1/customers/[id]/reset-rates': ['ADMIN'],
  // The API behind Assign task (SPEC section 5.1, SCR-04; architecture section 6 rows "Create task" and "Assign context", STORY-04.01): a Lead and an Admin assign, an Engineer never does (BR-004, CR-33).
  // Two rows, one per method, because the roles differ (STORY-04.02): the queue read is for every role (an Engineer is answered with their own tasks), the assignment is not.
  'GET /api/v1/tasks': ['ADMIN', 'LEAD', 'ENGINEER'],
  'POST /api/v1/tasks': ['ADMIN', 'LEAD'],
  '/api/v1/options/assign-context': ['ADMIN', 'LEAD'],
  // STORY-05.01 (SCR-05; architecture section 6 "Set customer": A L; E own, while editable): every role, an Engineer on their own estimate only.
  '/api/v1/estimates/[id]/customer': ['ADMIN', 'LEAD', 'ENGINEER'],
  // STORY-05.09: the Engineer's Calculate. Only the Engineer (SPEC section 9: a Lead's and an Admin's is Recalculate, STORY-06.04).
  'POST /api/v1/estimates/[id]/calculate': ['ENGINEER'],
  // STORY-06.04 (SCR-06's Recalculate; architecture section 6 row "Recalculate": A L): a Lead's and an Admin's press. An Engineer is refused with the fixed 403 before the ID is looked at (NFR-002, CR-33).
  'POST /api/v1/estimates/[id]/recalculate': ['ADMIN', 'LEAD'],
  // STORY-06.05 (SCR-06's Approve and lock; architecture section 6 row "Approve": A L): the guard of an approval. An Engineer is refused with the fixed 403 before the ID is looked at (NFR-002, CR-33).
  'POST /api/v1/estimates/[id]/approve': ['ADMIN', 'LEAD'],
  // STORY-06.08 (SCR-09's Unlock; architecture section 6 rows "Unlock preview" and "Unlock": A L): the Admin-only action is cancel (STORY-06.12), not unlock. An Engineer is refused with the fixed 403 before the ID is looked at (NFR-002, CR-33).
  'GET /api/v1/estimates/[id]/unlock-preview': ['ADMIN', 'LEAD'],
  'POST /api/v1/estimates/[id]/unlock': ['ADMIN', 'LEAD'],
  // STORY-06.12 (SCR-06's Cancel approval; architecture section 6 row "Cancel approval": A only, step-up): the Admin alone. A Lead and an Engineer are refused with the fixed 403 before the ID is looked at (NFR-002, CR-33).
  'POST /api/v1/estimates/[id]/approval/cancel': ['ADMIN'],
  // STORY-06.13 (SCR-06's Remove price; architecture section 6 row "Remove price": A only, step-up): the Admin alone, the same refusals before the ID is looked at (NFR-002, CR-33).
  'POST /api/v1/estimates/[id]/approval/remove-price': ['ADMIN'],
  // STORY-06.02 (SCR-06; architecture section 6 row "Cost": A L): the figures of the estimate review. An Engineer is refused with the fixed 403 before the ID is looked at (NFR-002, CR-33).
  '/api/v1/estimates/[id]/costs': ['ADMIN', 'LEAD'],
  // STORY-06.03 (SCR-07; architecture section 6 row "Cost details": A L): the six stages of one row with each formula. An Engineer is refused with the fixed 403 before either ID is looked at (NFR-002, CR-33).
  '/api/v1/estimates/[id]/nodes/[nodeId]/costs': ['ADMIN', 'LEAD'],
  // STORY-07.01 (SCR-10; architecture section 6 rows "Export" and "Export summary": A L): the Excel file and what the page shows before it. An Engineer is refused with the fixed 403, and no file, before the ID is looked at (NFR-002, CR-33).
  '/api/v1/estimates/[id]/export': ['ADMIN', 'LEAD'],
  '/api/v1/estimates/[id]/export-summary': ['ADMIN', 'LEAD'],
  // STORY-05.02 (architecture section 6 "Tree", "Node", "Reorder": A L; E own, while editable): every role, an Engineer on their own estimate only.
  '/api/v1/estimates/[id]/tree': ['ADMIN', 'LEAD', 'ENGINEER'],
  '/api/v1/estimates/[id]/tree/move': ['ADMIN', 'LEAD', 'ENGINEER'],
  '/api/v1/estimates/[id]/nodes': ['ADMIN', 'LEAD', 'ENGINEER'],
  '/api/v1/estimates/[id]/nodes/[nodeId]': ['ADMIN', 'LEAD', 'ENGINEER'],
  // STORY-04.04 (architecture section 6, "Task detail": A L; E own): one task and the status of its estimate, every role, an Engineer their own only.
  // STORY-04.07 (architecture section 6, "Change task": A L): the change of Engineer or deadline is its own row for a Lead and an Admin; an Engineer is refused (BR-004, CR-33).
  'GET /api/v1/tasks/[id]': ['ADMIN', 'LEAD', 'ENGINEER'],
  'PATCH /api/v1/tasks/[id]': ['ADMIN', 'LEAD'],
  // STORY-05.03 (architecture section 6 "Estimate form", "Save inputs": A L; E own, while editable): every role, an Engineer on their own estimate only.
  '/api/v1/estimates/[id]/form': ['ADMIN', 'LEAD', 'ENGINEER'],
  '/api/v1/estimates/[id]/nodes/[nodeId]/inputs': ['ADMIN', 'LEAD', 'ENGINEER'],
  // STORY-05.07 (architecture section 6 "Image": A L; E own, while editable): the picture of a part is added, replaced or removed, and read, by every role, an Engineer on their own estimate only.
  '/api/v1/estimates/[id]/nodes/[nodeId]/image': ['ADMIN', 'LEAD', 'ENGINEER'],
  '/api/v1/images/[id]': ['ADMIN', 'LEAD', 'ENGINEER'],
};
