import { describe, it, expect } from 'vitest'
import { buildTaskAdviceInsights } from './taskAiInsights'
import type { TaskDetail } from '@/types/task'

// Fake translate: returns the bare key, or "key|{...opts}" when interpolated —
// enough to assert both the branch taken and the values passed in (mirrors
// vacancyAiInsights.test.ts).
const t = (key: string, opts?: Record<string, unknown>) => (opts ? `${key}|${JSON.stringify(opts)}` : key)

// Minimal TaskDetail stub — only the fields the builder reads.
const base = (over: Partial<TaskDetail> = {}) => ({
  due: '', dueTime: '', statusIsDone: false, assigneeId: null, assignee: null, links: [],
  ...over,
} as unknown as TaskDetail)

describe('buildTaskAdviceInsights', () => {
  it('flags an unset due date, unassigned task, and no links', () => {
    const [due, assignee, links] = buildTaskAdviceInsights(base(), t)
    expect(due).toEqual({ type: 'ai.dueLabel', color: 'var(--text-muted)', text: 'ai.dueUnset' })
    // eslint-disable-next-line huisstijl/no-restricted-syntax -- DATA: semantic colour VALUE for the shared chip/donut/series recipes (tinted/chipInked downstream), not text ink
    expect(assignee).toEqual({ type: 'ai.assigneeLabel', color: 'var(--color-warning)', text: 'ai.unassigned' })
    // eslint-disable-next-line huisstijl/no-restricted-syntax -- DATA: semantic colour VALUE for the shared chip/donut/series recipes (tinted/chipInked downstream), not text ink
    expect(links).toEqual({ type: 'ai.linksLabel', color: 'var(--color-warning)', text: 'ai.noLinks' })
  })

  it('reports an overdue due date in whole days', () => {
    const now = new Date('2026-08-10T12:00:00')
    const [due] = buildTaskAdviceInsights(base({ due: '2026-08-05' }), t, now)
    expect(due.color).toBe('var(--color-danger)')
    expect(due.text).toBe('ai.dueOverdue|{"count":5}')
  })

  it('reports due-today distinctly from an upcoming date', () => {
    const now = new Date('2026-08-10T09:00:00')
    const [today] = buildTaskAdviceInsights(base({ due: '2026-08-10' }), t, now)
    expect(today.text).toBe('ai.dueToday')
    const [upcoming] = buildTaskAdviceInsights(base({ due: '2026-08-14' }), t, now)
    expect(upcoming.text).toBe('ai.dueUpcoming|{"count":4}')
  })

  it('never flags a DONE task as overdue, even past its due date', () => {
    const now = new Date('2026-08-10T12:00:00')
    const [due] = buildTaskAdviceInsights(base({ due: '2026-08-05', statusIsDone: true }), t, now)
    expect(due.text).not.toBe('ai.dueOverdue|{"count":5}')
  })

  it('reports the assignee name once assigned', () => {
    const [, assignee] = buildTaskAdviceInsights(base({ assigneeId: 'u1', assignee: { name: 'Anna', initials: 'A', color: null } }), t)
    // eslint-disable-next-line huisstijl/no-restricted-syntax -- DATA: fixture/config colour VALUE mirrored from the component contract, not ink painted by this test
    expect(assignee).toEqual({ type: 'ai.assigneeLabel', color: 'var(--color-success)', text: 'ai.assignedTo|{"name":"Anna"}' })
  })

  it('reports the link count once the task carries links', () => {
    const [, , links] = buildTaskAdviceInsights(base({ links: [{ type: 'candidate', id: 'c1', label: 'Anna' }] }), t)
    expect(links).toEqual({ type: 'ai.linksLabel', color: 'var(--color-secondary)', text: 'ai.linked|{"count":1}' })
  })
})
