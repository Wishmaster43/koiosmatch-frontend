/** Shared DATA fixtures for the AddTaskModal suites (plain data, no mocks). */

export const EDIT_ID = 'task-1'
export const FAIL_ID = 'task-fail'

// The full task detail as GET /tasks/{id} returns it (description/links only
// live here, not on the list row) — one pre-existing link ('opportunity') this
// form's pickers don't expose, to prove edit-mode carries it over on save.
export const TASK_DETAIL_RAW = {
  id: EDIT_ID,
  title: 'Bel kandidaat terug',
  // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
  type: { value: 'call', label: 'Belafspraak', color: '#5FB0AC' },
  // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
  status: { value: 'todo', label: 'Te doen', color: '#D98A8A', is_done: false },
  // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
  priority: { value: 'normal', label: 'Normaal', color: '#DDA071' },
  assignee: { id: 'user-9', name: 'Danny' },
  // TEAM-1: the task ALSO waits at an internal department — the two axes coexist
  // on one record, which is precisely what the edit path must not flatten.
  // eslint-disable-next-line no-restricted-syntax -- API fixture colour (DATA, mirrors the live row)
  assignee_team: { id: 'team-1', name: 'Backoffice', color: '#2563EB' },
  due_date: '2026-07-25',
  due_time: '14:00',
  description: '<p>Bespreek beschikbaarheid</p>',
  links: [
    { type: 'opportunity', id: 'opp-9', label: 'Deal X' },
    { type: 'candidate', id: 'cand-1', label: 'Piet Jansen' },
  ],
}
// Raw lookup rows (id = uuid FK, value = tenant-facing slug) — what BOTH the
// create and update requests actually need (TASKTYPE-ID-1), distinct from the
// slug-only options the form's pickers render. 'email' is included so the
// is_default-flag test below (a non-first default) can resolve its type_id too.
export const TYPE_ROWS     = [{ id: 'type-uuid-1', value: 'call', label: 'Belafspraak' }, { id: 'type-uuid-2', value: 'email', label: 'E-mail' }]
export const STATUS_ROWS   = [{ id: 'status-uuid-1', value: 'todo', label: 'Te doen' }]
export const PRIORITY_ROWS = [{ id: 'prio-uuid-1', value: 'normal', label: 'Normaal' }]
// Two candidates so the link picker's search box has something to filter
// (JOB B coverage: "a searchable picker filters its options").
export const CANDIDATE_ROWS = [
  { id: 'cand-1', name: 'Piet Jansen' },
  { id: 'cand-2', name: 'Klaas de Vries' },
]
// PUNT 15: a customer department, so the create form's shared link picker (the
// drawer's own AddLinkRow, one vocabulary) has a real row to couple the task to.
export const DEPARTMENT_ROWS = [{ id: 'dep-1', name: 'Backoffice Zorg' }]
// REFERENCE-LINK-1: cand-1's own references (GET /candidates/cand-1/references).
export const REFERENCE_ROWS = [{ id: 'ref-1', name: 'Karim El Amrani', relation: { label: 'Partner' } }]

export type TypeSeed = { value: string; label: string; color: string; is_default?: boolean }
// Initial lookup values for the mutable `lk` state each suite hoists (assigned right after the imports).
export const LK_SEED = {
  // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
  statuses: [{ value: 'todo', label: 'Te doen', color: '#D98A8A' }],
  // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
  types: [{ value: 'call', label: 'Belafspraak', color: '#5FB0AC' }] as TypeSeed[],
  // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
  priorities: [{ value: 'normal', label: 'Normaal', color: '#DDA071' }],
}

// Type lookup whose FLAGGED default is not first (proves the is_default flag wins over array position).
export const FLAGGED_DEFAULT_TYPES: TypeSeed[] = [
  // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
  { value: 'call', label: 'Belafspraak', color: '#5FB0AC', is_default: false },
  // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
  { value: 'email', label: 'E-mail', color: '#A98AD1', is_default: true },
]
