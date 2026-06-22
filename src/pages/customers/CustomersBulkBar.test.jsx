import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CustomersBulkBar from './CustomersBulkBar'

// i18n is not initialised in tests → t() returns the key, so we drive/assert on keys.
const baseProps = () => ({
  count: 2, onClear: vi.fn(),
  onSetOwner: vi.fn(), onSetStatus: vi.fn(), onAddTag: vi.fn(),
  onRemoveTag: vi.fn(), onAddNote: vi.fn(), onArchive: vi.fn(),
  users: [{ id: 'u1', name: 'Iris de Wit' }, { id: 'u2', name: 'Kelly van Vliet' }],
  statuses: [{ value: 'actief', label: 'Actief' }, { value: 'prospect', label: 'Prospect' }],
  selectedTags: ['Zorg', 'Regio West'],
})

describe('CustomersBulkBar', () => {
  it('hides Archive unless the user may delete', async () => {
    const user = userEvent.setup()
    render(<CustomersBulkBar {...baseProps()} canArchive={false} />)
    await user.click(screen.getByText('bulk.actions'))
    expect(screen.getByText('bulk.changeOwner')).toBeInTheDocument()
    expect(screen.queryByText('bulk.archive')).toBeNull()
  })

  it('shows Archive and fires onArchive when permitted', async () => {
    const user = userEvent.setup()
    const props = { ...baseProps(), canArchive: true }
    render(<CustomersBulkBar {...props} />)
    await user.click(screen.getByText('bulk.actions'))
    await user.click(screen.getByText('bulk.archive'))
    expect(props.onArchive).toHaveBeenCalledTimes(1)
  })

  it('resolves a picked account manager back to the full user object', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<CustomersBulkBar {...props} />)
    await user.click(screen.getByText('bulk.actions'))
    await user.click(screen.getByText('bulk.changeOwner'))
    await user.click(screen.getByText('Iris de Wit'))
    expect(props.onSetOwner).toHaveBeenCalledWith({ id: 'u1', name: 'Iris de Wit' })
  })

  it('passes the chosen status value through', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<CustomersBulkBar {...props} />)
    await user.click(screen.getByText('bulk.actions'))
    await user.click(screen.getByText('bulk.changeStatus'))
    await user.click(screen.getByText('Actief'))
    expect(props.onSetStatus).toHaveBeenCalledWith('actief')
  })
})
