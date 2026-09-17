/**
 * useTaskOptions — KPI-RIJ-9-1 additions: the "per medewerker" donut data
 * (assigneeData, mirrors assigneeOptions) and the unassigned KPI count (open
 * task with no assignee, no team AND no role — verifier fix, TAAK-ROL-1).
 */
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useTaskOptions } from './useTaskOptions'
import type { Task } from '@/types/task'

const t = (over: Partial<Task>): Task => ({
  id: 'x', statusKey: 'todo', priorityKey: 'normal', typeKey: 'task',
  statusIsDone: false, assignee: null, team: null, ...over,
} as Task)

describe('useTaskOptions · KPI-RIJ-9-1 additions', () => {
  it('builds assigneeData from the loaded rows, mirroring assigneeOptions', () => {
    const all = [
      t({ id: '1', assignee: { name: 'Nora', initials: 'N', color: null } }),
      t({ id: '2', assignee: { name: 'Nora', initials: 'N', color: null } }),
      t({ id: '3', assignee: { name: 'Sara', initials: 'S', color: null } }),
      t({ id: '4', assignee: null }),
    ]
    const { result } = renderHook(() => useTaskOptions({ all, statuses: [], priorities: [], types: [] }))
    expect(result.current.assigneeData).toEqual([
      { name: 'Nora', key: 'Nora', value: 2 },
      { name: 'Sara', key: 'Sara', value: 1 },
    ])
  })

  it('counts unassigned as open tasks with no assignee, no team AND no role', () => {
    const all = [
      t({ id: '1', statusIsDone: false, assignee: null, team: null }),
      t({ id: '2', statusIsDone: false, assignee: { name: 'Nora', initials: 'N', color: null }, team: null }),
      t({ id: '3', statusIsDone: false, assignee: null, team: { id: 'tm', name: 'Backoffice', color: null } }),
      t({ id: '4', statusIsDone: true, assignee: null, team: null }),
      // TAAK-ROL-1 verifier fix: a role-assigned open task must not count as unassigned.
      t({ id: '5', statusIsDone: false, assignee: null, team: null, assigneeRole: { id: 'r1', name: 'Recruiter', mode: 'first' } }),
    ]
    const { result } = renderHook(() => useTaskOptions({ all, statuses: [], priorities: [], types: [] }))
    // Only row 1 is open, unassigned, team-less AND role-less — a done row, one
    // with an assignee/team, or one queued for a role never counts.
    expect(result.current.unassigned).toBe(1)
  })
})
