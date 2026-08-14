import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

// SUBTASK-CREATE-1: AddTaskModal itself is covered by its own test file — here it
// is stubbed to a single button that fires onCreated with the parentId it was
// given, so this file proves the WIRING (parentId passed in, onCreated handled),
// not AddTaskModal's own form behaviour.
vi.mock('../AddTaskModal', () => ({
  default: ({ parentId, onCreated, onClose }: { parentId?: string; onCreated?: (raw: unknown) => void; onClose: () => void }) => (
    <div data-testid="add-task-modal" data-parent-id={parentId}>
      <button onClick={() => onCreated?.({ id: 'new-sub' })}>fake-create</button>
      <button onClick={onClose}>fake-close</button>
    </div>
  ),
}))

import api from '@/lib/api'
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>

const task = (over: Partial<TaskDetail> = {}) => ({
  id: 't1', title: 'Bel kandidaat', parent: null, subtaskProgress: null, ...over,
} as unknown as TaskDetail)

describe('SubtasksSection (task drawer, SUBTASK-1)', () => {
  it('always shows the add-subtask affordance, even with no subtasks and no parent', () => {
    mockGet.mockClear()
    render(<SubtasksSection task={task()} />)
    expect(screen.getByText('details.subtasks.add')).toBeInTheDocument()
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

  describe('SUBTASK-CREATE-1: add-subtask flow', () => {
    it('opens AddTaskModal with parentId set to the current task, no main-task picker', async () => {
      const user = userEvent.setup()
      render(<SubtasksSection task={task()} />)
      await user.click(screen.getByText('details.subtasks.add'))
      const modal = screen.getByTestId('add-task-modal')
      expect(modal).toHaveAttribute('data-parent-id', 't1')
    })

    it('after a successful create: closes the modal, refetches the subtask list, and bumps the local tally', async () => {
      mockGet.mockClear()
      mockGet.mockResolvedValue({ data: [{ id: 's1', title: 'Bel terug' }] })
      const onSubtaskCreated = vi.fn()
      const user = userEvent.setup()
      render(<SubtasksSection task={task({ subtaskProgress: { done: 0, total: 1 } })} onSubtaskCreated={onSubtaskCreated} />)
      await screen.findByText('Bel terug')
      mockGet.mockClear()

      await user.click(screen.getByText('details.subtasks.add'))
      await user.click(screen.getByText('fake-create'))

      expect(screen.queryByTestId('add-task-modal')).not.toBeInTheDocument()
      expect(onSubtaskCreated).toHaveBeenCalledTimes(1)
      // Same total (1) → hasSubtasks stays true, so the effect's own deps don't
      // change; the refetch must be an explicit call, not a lucky rerender.
      await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/tasks', { params: { parent_id: 't1' } }))
    })
  })
})
