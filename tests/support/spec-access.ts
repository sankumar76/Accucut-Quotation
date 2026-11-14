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
  '/config/checkpoints': ['ADMIN'], // Insert and delete fields, checkpoints: Admin
  '/users': ['ADMIN'], // Users
  '/settings': ['ADMIN'], // Settings
  '/audit': ['ADMIN'], // Audit log
  '/about': ['ADMIN', 'LEAD', 'ENGINEER'], // About: all
  // The API behind the Users screen (SPEC section 9: Users is the Admin's; architecture section 6 rows "Users" and "Reset user password").
  '/api/v1/users': ['ADMIN'],
  '/api/v1/users/[id]': ['ADMIN'],
  '/api/v1/users/[id]/password-reset': ['ADMIN'],
  // The API behind the Audit log screen (SPEC section 9: the audit log is the Admin's; architecture section 6 row "Audit", CR-33).
  '/api/v1/audit': ['ADMIN'],
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
  // STORY-05.02 (architecture section 6 "Tree", "Node", "Reorder": A L; E own, while editable): every role, an Engineer on their own estimate only.
  '/api/v1/estimates/[id]/tree': ['ADMIN', 'LEAD', 'ENGINEER'],
  '/api/v1/estimates/[id]/tree/move': ['ADMIN', 'LEAD', 'ENGINEER'],
  '/api/v1/estimates/[id]/nodes': ['ADMIN', 'LEAD', 'ENGINEER'],
  '/api/v1/estimates/[id]/nodes/[nodeId]': ['ADMIN', 'LEAD', 'ENGINEER'],
};
