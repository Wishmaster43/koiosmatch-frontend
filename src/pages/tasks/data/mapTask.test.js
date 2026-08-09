import { describe, it, expect } from 'vitest'
import { mapTask, mapTaskDetail, dueDateTime, isTaskOverdue } from './mapTask'

describe('mapTask', () => {
  it('maps a row with nested lookup objects + assignee + links', () => {
    const row = mapTask({
      id: 't1', title: 'Bel kandidaat',
      // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
      type: { value: 'call', label: 'Belafspraak', color: '#5FB0AC' },
      // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
      status: { value: 'todo', label: 'TeDoen', color: '#D98A8A', is_done: false },
      // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
      priority: { value: 'high', label: 'Hoog', color: '#D98A8A' },
      assignee: { id: 'u1', name: 'Danny Polak', avatar_color: '#abc' },
      owner: { id: 'u2', name: 'Kelly van Vliet' },
      due_date: '2026-06-30',
      links: [{ type: 'candidate', id: 'c1', label: 'Rosa Tijssen' }],
      comment_count: 2,
    })
    expect(row).toMatchObject({
      id: 't1', title: 'Bel kandidaat',
      typeKey: 'call', statusKey: 'todo', statusIsDone: false, priorityKey: 'high',
      assigneeId: 'u1', due: '2026-06-30', linkLabel: 'Rosa Tijssen', commentCount: 2,
    })
    expect(row.assignee).toMatchObject({ name: 'Danny Polak', initials: 'DP', color: '#abc' })
    expect(row.owner.name).toBe('Kelly van Vliet')
  })

  it('treats a missing assignee as bureau (null) and tolerates flat fields', () => {
    const row = mapTask({ id: 't2', title: 'Notitie', status: 'in_progress', completed_at: null })
    expect(row.assignee).toBeNull()
    expect(row.assigneeId).toBeNull()
    expect(row.statusKey).toBe('in_progress')
    expect(row.statusIsDone).toBe(false)
  })

  // TEAM-1: `assignee_team` is the INTERNAL department the task waits at, an axis
  // of its own next to the assignee — a row can carry both, either, or neither.
  it('maps assignee_team to the team pair, independently of the assignee', () => {
    const both = mapTask({
      id: 't4', title: 'Contract verwerken',
      assignee: { id: 'u1', name: 'Kelly Yesway' },
      // eslint-disable-next-line no-restricted-syntax -- API fixture colour (DATA, mirrors the live row)
      assignee_team: { id: 'team-1', name: 'Backoffice', color: '#2563EB' },
    })
    expect(both.assigneeId).toBe('u1')
    // eslint-disable-next-line no-restricted-syntax -- API fixture colour (DATA, mirrors the live row)
    expect(both).toMatchObject({ teamId: 'team-1', team: { id: 'team-1', name: 'Backoffice', color: '#2563EB' } })

    // "Openstaand bij Backoffice" — department set, nobody assigned.
    const queued = mapTask({ id: 't5', title: 'Wacht op backoffice', assignee_team: { id: 'team-1', name: 'Backoffice' } })
    expect(queued.assignee).toBeNull()
    expect(queued).toMatchObject({ teamId: 'team-1', team: { id: 'team-1', name: 'Backoffice', color: null } })

    // No department at all stays an honest null pair, never a fabricated row.
    const none = mapTask({ id: 't6', title: 'Losse taak' })
    expect(none.teamId).toBeNull()
    expect(none.team).toBeNull()
  })

  it('marks done from completed_at when the status object is absent', () => {
    const row = mapTask({ id: 't3', title: 'Klaar', completed_at: '2026-06-20' })
    expect(row.statusIsDone).toBe(true)
  })

  it('never throws on an empty record and fills safe defaults', () => {
    const row = mapTask({})
    expect(row.title).toBe('—')
    expect(row.links).toEqual([])
    expect(row.commentCount).toBe(0)
    expect(row.dueTime).toBe('')
    expect(row.archived).toBe(false)
  })

  // TASK-DUE-TIME-1 (BE 3f1274d): due_time is "HH:mm" on the resource, '' when unset.
  it('maps due_time through and keeps date-only tasks timeless', () => {
    expect(mapTask({ id: 't5', due_date: '2026-06-30', due_time: '14:30' }).dueTime).toBe('14:30')
    expect(mapTask({ id: 't6', due_date: '2026-06-30' }).dueTime).toBe('')
  })

  // TASK-LOCATION-READ-1 (BE golf 2a/2b, 2026-08-08): TaskListResource/
  // TaskDetailResource now emit `location {id,name}|null` after `priority`.
  it('maps the branch (location) through, id + name', () => {
    const row = mapTask({ id: 't7', location: { id: 'loc-1', name: 'Vestiging Noord' } })
    expect(row.locationId).toBe('loc-1')
    expect(row.location).toEqual({ id: 'loc-1', name: 'Vestiging Noord' })
  })

  it('treats a missing/null location as no branch, never a crash', () => {
    const row = mapTask({ id: 't8' })
    expect(row.locationId).toBeNull()
    expect(row.location).toBeNull()
  })
})

// TASK-DUE-TIME-1 helpers: date+time combination and the time-aware overdue rule.
describe('dueDateTime', () => {
  it('combines a due date with an HH:mm time', () => {
    const d = dueDateTime('2026-06-30', '14:30')
    expect(d?.getHours()).toBe(14)
    expect(d?.getMinutes()).toBe(30)
  })

  it('falls back to midnight without a time and null without a date', () => {
    expect(dueDateTime('2026-06-30')?.getHours()).toBe(0)
    expect(dueDateTime('')).toBeNull()
    expect(dueDateTime(undefined)).toBeNull()
  })
})

describe('isTaskOverdue', () => {
  const noon = new Date('2026-06-30T12:00:00')

  it('date-only: overdue after the due DAY, never on the due day itself', () => {
    expect(isTaskOverdue({ due: '2026-06-29' }, noon)).toBe(true)
    expect(isTaskOverdue({ due: '2026-06-30' }, noon)).toBe(false)
    expect(isTaskOverdue({ due: '2026-07-01' }, noon)).toBe(false)
  })

  it('timed: overdue from the due MOMENT on the due day', () => {
    expect(isTaskOverdue({ due: '2026-06-30', dueTime: '09:00' }, noon)).toBe(true)
    expect(isTaskOverdue({ due: '2026-06-30', dueTime: '14:30' }, noon)).toBe(false)
  })

  it('a done or dateless task is never overdue', () => {
    expect(isTaskOverdue({ due: '2026-06-29', statusIsDone: true }, noon)).toBe(false)
    expect(isTaskOverdue({ due: '' }, noon)).toBe(false)
  })
})

describe('mapTaskDetail', () => {
  it('normalises description, comments and the activity log', () => {
    const detail = mapTaskDetail({
      id: 't1', title: 'Test', description: 'Doe dit',
      comments: [{ id: 'k1', author: { name: 'Danny Polak' }, body: 'Done', created_at: '2026-06-18' }],
      activity: [{ id: 'a1', author: { name: 'System' }, description: 'Status → Afgerond', created_at: '2026-06-19' }],
    })
    expect(detail.description).toBe('Doe dit')
    expect(detail.comments[0]).toMatchObject({ author: 'Danny Polak', authorInitials: 'DP', body: 'Done' })
    expect(detail.activity[0]).toMatchObject({ author: 'System', description: 'Status → Afgerond' })
  })
})
