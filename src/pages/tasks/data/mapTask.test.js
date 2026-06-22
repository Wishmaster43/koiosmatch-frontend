import { describe, it, expect } from 'vitest'
import { mapTask, mapTaskDetail } from './mapTask'

describe('mapTask', () => {
  it('maps a row with nested lookup objects + assignee + links', () => {
    const row = mapTask({
      id: 't1', title: 'Bel kandidaat',
      type: { value: 'call', label: 'Belafspraak', color: '#5FB0AC' },
      status: { value: 'todo', label: 'TeDoen', color: '#D98A8A', is_done: false },
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

  it('marks done from completed_at when the status object is absent', () => {
    const row = mapTask({ id: 't3', title: 'Klaar', completed_at: '2026-06-20' })
    expect(row.statusIsDone).toBe(true)
  })

  it('never throws on an empty record and fills safe defaults', () => {
    const row = mapTask({})
    expect(row.title).toBe('—')
    expect(row.links).toEqual([])
    expect(row.commentCount).toBe(0)
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
