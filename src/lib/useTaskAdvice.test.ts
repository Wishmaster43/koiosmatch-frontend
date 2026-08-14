/**
 * useTaskAdvice — the ONE resolver shared by the tasks table column and the
 * drawer (KOIOS-ADVIES-OVERAL-1). Verifies it mirrors isTaskOverdue exactly:
 * overdue fires with a translated label/reason, done/future tasks stay null.
 */
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import '@/i18n'
import { useTaskAdvice } from './useTaskAdvice'
import type { Task } from '@/types/task'

// Minimal Task stub — only the fields isTaskOverdue reads matter here.
function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    due: '2020-01-01',
    dueTime: '',
    statusIsDone: false,
    ...overrides,
  } as Task
}

describe('useTaskAdvice', () => {
  it('fires "overdue" for a task past its due date, with a translated label + reason', () => {
    const { result } = renderHook(() => useTaskAdvice())
    const advice = result.current(makeTask())
    expect(advice).not.toBeNull()
    expect(advice!.action).toBe('overdue')
    expect(advice!.source).toBe('rules')
    expect(advice!.label).toBe('Te laat')
    expect(advice!.reason).toBe('Deze taak is over de deadline.')
  })

  it('stays null for a done task and for a future due date', () => {
    const { result } = renderHook(() => useTaskAdvice())
    expect(result.current(makeTask({ statusIsDone: true }))).toBeNull()
    expect(result.current(makeTask({ due: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10) }))).toBeNull()
  })
})
