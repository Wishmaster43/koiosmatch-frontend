import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CandidatesBulkBar from './CandidatesBulkBar'

// The bar fetches /pools on mount; stub the api client so no real request runs.
vi.mock('../../lib/api', () => ({ default: { get: vi.fn(() => Promise.resolve({ data: [] })) } }))

// i18n is not initialised in tests → t() returns the key, so we drive/assert on keys.
const baseProps = () => ({
  count: 3, onClear: vi.fn(),
  onAddToPool: vi.fn(), onRemoveFromPool: vi.fn(),
  onSetOwner: vi.fn(), onSetStage: vi.fn(), onSetType: vi.fn(),
  onRemoveTag: vi.fn(), onAddNote: vi.fn(), onArchive: vi.fn(),
  users: [{ id: 'u1', name: 'Bente de Jong' }, { id: 'u2', name: 'Kelly van Vliet' }],
  funnelTypes: [{ value: 'pool', label: 'Pool' }, { value: 'intake', label: 'Intake' }],
  candidateTypes: [{ value: 'freelance', label: 'ZZP' }],
  selectedTags: ['Amsterdam', 'MBO'],
})

describe('CandidatesBulkBar', () => {
  it('hides Archive unless the user may delete', async () => {
    const user = userEvent.setup()
    render(<CandidatesBulkBar {...baseProps()} canArchive={false} />)
    await user.click(screen.getByText('bulk.actions'))
    expect(screen.getByText('bulk.changeOwner')).toBeInTheDocument()
    expect(screen.queryByText('bulk.archive')).toBeNull()
  })

  it('shows Archive and fires onArchive when permitted', async () => {
    const user = userEvent.setup()
    const props = { ...baseProps(), canArchive: true }
    render(<CandidatesBulkBar {...props} />)
    await user.click(screen.getByText('bulk.actions'))
    await user.click(screen.getByText('bulk.archive'))
    expect(props.onArchive).toHaveBeenCalledTimes(1)
  })

  it('resolves a picked owner back to the full user object', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<CandidatesBulkBar {...props} />)
    await user.click(screen.getByText('bulk.actions'))
    await user.click(screen.getByText('bulk.changeOwner'))
    await user.click(screen.getByText('Bente de Jong'))
    expect(props.onSetOwner).toHaveBeenCalledWith({ id: 'u1', name: 'Bente de Jong' })
  })

  it('passes the chosen funnel stage value through', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<CandidatesBulkBar {...props} />)
    await user.click(screen.getByText('bulk.actions'))
    await user.click(screen.getByText('bulk.changeStage'))
    await user.click(screen.getByText('Pool'))
    expect(props.onSetStage).toHaveBeenCalledWith('pool')
  })
})
