import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TasksBulkBar from './TasksBulkBar'

// i18n is not initialised in tests → t() returns the key, so we drive/assert on keys.
const baseProps = () => ({
  count: 3, onClear: vi.fn(),
  onSetStatus: vi.fn(), onSetPriority: vi.fn(), onSetAssignee: vi.fn(), onArchive: vi.fn(),
  statuses: [{ value: 'todo', label: 'TeDoen', color: '#000' }, { value: 'done', label: 'Afgerond', color: '#0a0' }],
  priorities: [{ value: 'high', label: 'Hoog', color: '#a00' }],
  users: [{ id: 'u1', name: 'Bente de Jong' }, { id: 'u2', name: 'Kelly van Vliet' }],
})

describe('TasksBulkBar', () => {
  it('hides Archive unless the user may manage (update-gated)', async () => {
    const user = userEvent.setup()
    render(<TasksBulkBar {...baseProps()} canArchive={false} />)
    await user.click(screen.getByText('bulk.actions'))
    expect(screen.getByText('bulk.changeStatus')).toBeInTheDocument()
    expect(screen.queryByText('bulk.archive')).toBeNull()
  })

  it('shows Archive and fires onArchive when permitted', async () => {
    const user = userEvent.setup()
    const props = { ...baseProps(), canArchive: true }
    render(<TasksBulkBar {...props} />)
    await user.click(screen.getByText('bulk.actions'))
    await user.click(screen.getByText('bulk.archive'))
    expect(props.onArchive).toHaveBeenCalledTimes(1)
  })

  it('passes the chosen status value through', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<TasksBulkBar {...props} />)
    await user.click(screen.getByText('bulk.actions'))
    await user.click(screen.getByText('bulk.changeStatus'))
    await user.click(screen.getByText('TeDoen'))
    expect(props.onSetStatus).toHaveBeenCalledWith('todo')
  })

  it('resolves a picked assignee to its user id', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<TasksBulkBar {...props} />)
    await user.click(screen.getByText('bulk.actions'))
    await user.click(screen.getByText('bulk.changeAssignee'))
    await user.click(screen.getByText('Kelly van Vliet'))
    expect(props.onSetAssignee).toHaveBeenCalledWith('u2')
  })
})
