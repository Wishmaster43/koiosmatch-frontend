/**
 * TasksDueTodayList — renders open tasks and navigates to the task drawer on click.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TasksDueTodayList from './TasksDueTodayList'
import type { TaskDueTodayRow } from '@/types/dashboard'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? k }) }))

const row: TaskDueTodayRow = {
  task_id: 't1', title: 'Call candidate', priority: { value: 'high', label: 'High', color: 'var(--color-danger-text)' },
  due_time: '14:00', assignee_id: 'u1', assignee: { id: 'u1', name: 'Anna' },
}
const rowNoTime: TaskDueTodayRow = { ...row, task_id: 't2', due_time: null }

describe('TasksDueTodayList', () => {
  it('self-hides on an empty feed', () => {
    const { container } = render(<TasksDueTodayList rows={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a row from the exact server shape and navigates on click', () => {
    const onNavigate = vi.fn()
    render(<TasksDueTodayList rows={[row]} onNavigate={onNavigate} />)
    expect(screen.getByText('Call candidate')).toBeInTheDocument()
    // SoftChip renders the priority label, colour passed straight through.
    expect(screen.getByText('High')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Call candidate'))
    expect(onNavigate).toHaveBeenCalledWith('tasks', { open: 't1' })
  })

  it('falls back to a dash for a null due_time', () => {
    render(<TasksDueTodayList rows={[rowNoTime]} onNavigate={vi.fn()} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
