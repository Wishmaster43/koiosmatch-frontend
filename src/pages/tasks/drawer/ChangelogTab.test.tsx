/**
 * ChangelogTab (tasks) — verifies the wrapper hits the right REQUEST
 * (GET /tasks/{id}/activity) via useTaskActivity and renders a real entry
 * through the shared EntityChangelogTab, replacing the old bespoke ActivityTab.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import ChangelogTab from './ChangelogTab'
import type { TaskDetail } from '@/types/task'

const getMock = vi.hoisted(() => vi.fn(() => Promise.resolve({ data: [
  { id: 'e1', causer_name: 'Jill', created_at: '2026-08-27', description: 'Updated',
    changes: { attributes: { title: 'New title' }, old: { title: 'Old title' } } },
] })))
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: getMock } }
})
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v, formatDateTime: (v: string) => v, locale: 'nl-NL' }) }))

const task = { id: 't1' } as TaskDetail

describe('tasks ChangelogTab', () => {
  it('fetches GET /tasks/{id}/activity and renders a diff card', async () => {
    const { container } = render(<ChangelogTab task={task} />)
    await waitFor(() => expect(getMock).toHaveBeenCalledWith('/tasks/t1/activity', expect.anything()))
    await waitFor(() => expect(container.textContent).toContain('Jill'))
  })
})
