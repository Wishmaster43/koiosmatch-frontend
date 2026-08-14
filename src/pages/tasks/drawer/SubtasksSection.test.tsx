import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import SubtasksSection from './SubtasksSection'
import type { TaskDetail } from '@/types/task'

// Mirrors RelatedTasks.test.tsx's own-fetch tab pattern — real unwrap/unwrapList
// (importActual), only the default client stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(() => Promise.resolve({ data: [] })) } }
})

const openEntity = vi.fn()
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity }) }))

import api from '@/lib/api'
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>

const task = (over: Partial<TaskDetail> = {}) => ({
  id: 't1', title: 'Bel kandidaat', parent: null, subtaskProgress: null, ...over,
} as unknown as TaskDetail)

describe('SubtasksSection (task drawer, SUBTASK-1)', () => {
  it('renders nothing and fetches nothing when the task has no subtasks and is not a subtask itself', () => {
    mockGet.mockClear()
    const { container } = render(<SubtasksSection task={task()} />)
    expect(container).toBeEmptyDOMElement()
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('fetches the subtasks with ?parent_id= when the task has subtasks, and shows the progress tally', async () => {
    mockGet.mockClear()
    mockGet.mockResolvedValueOnce({ data: [
      { id: 's1', title: 'Bel terug', status: { label: 'Open', color: '#888888' } },
    ] })
    render(<SubtasksSection task={task({ subtaskProgress: { done: 2, total: 5 } })} />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/tasks', { params: { parent_id: 't1' } }))
    expect(await screen.findByText('Bel terug')).toBeInTheDocument()
    expect(screen.getByText('2/5')).toBeInTheDocument()
  })

  it('shows a distinct error state when the subtask load fails', async () => {
    mockGet.mockClear()
    mockGet.mockRejectedValueOnce({ response: { status: 500 } })
    render(<SubtasksSection task={task({ subtaskProgress: { done: 0, total: 3 } })} />)
    expect(await screen.findByText('details.subtasks.error')).toBeInTheDocument()
  })

  it('shows a reference row to the main task when this task itself is a subtask', () => {
    mockGet.mockClear()
    render(<SubtasksSection task={task({ parent: { id: 'p1', title: 'Hoofdtaak: onboarding' } })} />)
    expect(screen.getByText('Hoofdtaak: onboarding')).toBeInTheDocument()
    // No own subtasks → no fetch triggered for this task's id.
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('opens the main task on click of the reference row', async () => {
    render(<SubtasksSection task={task({ parent: { id: 'p1', title: 'Hoofdtaak' } })} />)
    screen.getByText('Hoofdtaak').closest('button')?.click()
    expect(openEntity).toHaveBeenCalledWith('tasks', 'p1')
  })

  it('opens a subtask row on click, navigating to that task', async () => {
    mockGet.mockClear()
    mockGet.mockResolvedValueOnce({ data: [{ id: 's1', title: 'Bel terug' }] })
    render(<SubtasksSection task={task({ subtaskProgress: { done: 0, total: 1 } })} />)
    const row = await screen.findByText('Bel terug')
    row.closest('button')?.click()
    expect(openEntity).toHaveBeenCalledWith('tasks', 's1')
  })
})
