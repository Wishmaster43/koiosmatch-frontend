import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VacanciesBulkBar from './VacanciesBulkBar'

// i18n is not initialised in tests → t() returns the key, so we drive/assert on keys.
const baseProps = () => ({
  count: 3, onClear: vi.fn(),
  onSetOwner: vi.fn(), onSetStatus: vi.fn(), onSetClient: vi.fn(),
  onPublish: vi.fn(), onUnpublish: vi.fn(),
  onRemoveTag: vi.fn(), onAddNote: vi.fn(), onArchive: vi.fn(),
  users: [{ id: 'u1', name: 'Bente de Jong' }, { id: 'u2', name: 'Kelly van Vliet' }],
  statuses: [{ value: 'open', label: 'Open' }, { value: 'closed', label: 'Gesloten' }],
  customers: [{ id: 'c1', name: 'Yesway zorg' }],
  selectedTags: ['Den Haag', 'zorg'],
})

describe('VacanciesBulkBar', () => {
  it('hides Archive unless the user may delete', async () => {
    const user = userEvent.setup()
    render(<VacanciesBulkBar {...baseProps()} canArchive={false} />)
    await user.click(screen.getByText('bulk.actions'))
    expect(screen.getByText('bulk.changeOwner')).toBeInTheDocument()
    expect(screen.queryByText('bulk.archive')).toBeNull()
  })

  it('shows Archive and fires onArchive when permitted', async () => {
    const user = userEvent.setup()
    const props = { ...baseProps(), canArchive: true }
    render(<VacanciesBulkBar {...props} />)
    await user.click(screen.getByText('bulk.actions'))
    await user.click(screen.getByText('bulk.archive'))
    expect(props.onArchive).toHaveBeenCalledTimes(1)
  })

  it('resolves a picked owner back to the full user object', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<VacanciesBulkBar {...props} />)
    await user.click(screen.getByText('bulk.actions'))
    await user.click(screen.getByText('bulk.changeOwner'))
    await user.click(screen.getByText('Bente de Jong'))
    expect(props.onSetOwner).toHaveBeenCalledWith({ id: 'u1', name: 'Bente de Jong' })
  })

  it('passes the chosen status value through', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<VacanciesBulkBar {...props} />)
    await user.click(screen.getByText('bulk.actions'))
    await user.click(screen.getByText('bulk.changeStatus'))
    await user.click(screen.getByText('Open'))
    expect(props.onSetStatus).toHaveBeenCalledWith('open')
  })

  it('fires publish / unpublish from the publishing submenu', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<VacanciesBulkBar {...props} />)
    await user.click(screen.getByText('bulk.actions'))
    await user.click(screen.getByText('bulk.publishing'))
    await user.click(screen.getByText('bulk.publish'))
    expect(props.onPublish).toHaveBeenCalledTimes(1)
  })
})
