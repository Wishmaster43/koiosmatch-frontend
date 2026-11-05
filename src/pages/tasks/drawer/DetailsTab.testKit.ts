/** Shared DATA fixtures for the tasks DetailsTab suites (plain data, no mocks). */
/* eslint-disable no-restricted-syntax -- test fixture lookup colours (DATA, not UI styling) */
import type { TaskDetail } from '@/types/task'

export const TYPES = [{ value: 'call', label: 'Belafspraak', color: '#888888' }]
export const STATUSES = [{ value: 'todo', label: 'Te doen', color: '#888888' }, { value: 'done', label: 'Afgerond', color: '#00aa00' }]
export const PRIORITIES = [{ value: 'normal', label: 'Normaal', color: '#888888' }, { value: 'high', label: 'Hoog', color: '#cc0000' }]
// Fallback colour, mirrors the real makeMetaResolver default.
export const FALLBACK_COLOR = '#9CA3AF'
export const TEAMS = [
  { value: 'team-1', label: 'Backoffice', color: '#2563EB' },
  { value: 'team-2', label: 'Planning', color: null },
]

// A minimal drawer-ready task detail.
export const TASK: TaskDetail = {
  id: 't1', title: 'Bel kandidaat', typeKey: 'call', typeLabel: 'Belafspraak', typeColor: null,
  statusKey: 'todo', statusLabel: 'Te doen', statusColor: '#888888', statusIsDone: false,
  priorityKey: 'normal', priorityLabel: 'Normaal', priorityColor: null,
  assigneeId: null, assignee: null, owner: { name: 'Danny' },
  due: '2026-08-01', dueTime: '', completedAt: '', tags: [], links: [], linkLabel: '', commentCount: 0,
  createdAt: '2026-07-01T10:00:00', description: '<p>Existing description</p>',
  comments: [], customFields: {}, archived: false, archivedAt: null,
  // TASK-LOCATION-READ-1: no branch by default; the picker's own tests (DetailsTab.fields.test.tsx) set one.
  locationId: null, location: null,
  // TEAM-1: no internal department by default; the TEAM-1 tests (DetailsTab.test.tsx) set one.
  teamId: null, team: null,
}
