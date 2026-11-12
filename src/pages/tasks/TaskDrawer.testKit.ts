/** Shared fixtures for the TaskDrawer suites (plain data, no mocks: vi.mock stays per test file). */
import type { TaskDetail } from '@/types/task'
import { TASK } from './drawer/DetailsTab.testKit'

// A minimal drawer-ready task (the DetailsTab base task with no due date or description); `archived` (+ optional `archivedAt`) flips per test.
export const task = (archived: boolean, archivedAt: string | null = null): TaskDetail => ({
  ...TASK, due: '', description: '', archived, archivedAt,
})

/* eslint-disable no-restricted-syntax -- test fixture lookup colours (DATA, not UI styling) */
// Fresh tenant task-lookup rows per call, so a test that mutates a colour never leaks into a sibling file.
export const lookupFixtures = () => ({
  statuses: [{ value: 'todo', label: 'Te doen', color: '#888888' }, { value: 'done', label: 'Afgerond', color: '#00aa00' }],
  types: [{ value: 'call', label: 'Belafspraak', color: '#888888' }],
  priorities: [{ value: 'normal', label: 'Normaal', color: '#888888' }],
})
/* eslint-enable no-restricted-syntax */

// Mirrors the REAL makeMetaResolver fallback (lib/lookupUtils.ts): an unmatched value falls back to its raw value as label and neutral grey.
export const metaOf = (list: { value: string; label: string; color: string }[]) =>
  (v?: string | number | null) => list.find(i => i.value === v) ??
    // eslint-disable-next-line no-restricted-syntax -- test fixture fallback colour, mirrors the real makeMetaResolver default
    { value: String(v ?? ''), label: String(v ?? ''), color: '#9CA3AF' }
