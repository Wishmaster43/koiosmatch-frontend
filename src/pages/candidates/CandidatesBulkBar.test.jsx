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
  onSetOwner: vi.fn(), onSetStage: vi.fn(), onSetTypes: vi.fn(),
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

  // Job 35: the bulk funnel-stage action moves each candidate's LATEST application
  // (the BE has no vacancy scope) — the drill-in must say so instead of reading as
  // if a vacancy could be picked.
  it('shows the BE-scope info line when drilling into "change funnel stage"', async () => {
    const user = userEvent.setup()
    render(<CandidatesBulkBar {...baseProps()} />)
    await user.click(screen.getByText('bulk.actions'))
    await user.click(screen.getByText('bulk.changeStage'))
    expect(screen.getByText('bulk.stageNote')).toBeInTheDocument()
  })

  it('applies the exact candidate-type set via the multi-select (add/remove)', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<CandidatesBulkBar {...props} />)
    await user.click(screen.getByText('bulk.actions'))
    await user.click(screen.getByText('bulk.changeType'))
    await user.click(screen.getByText('ZZP'))            // toggle the type on
    await user.click(screen.getByText(/bulk\.typeSubmit/)) // confirm bar shows "key (1)"
    expect(props.onSetTypes).toHaveBeenCalledWith(['freelance'])
  })

  // Punt 4 (bulk-merge entry): pairwise only — the menu item must never appear
  // for a selection size other than exactly 2, regardless of permission.
  it('hides Samenvoegen when the selection is not exactly 2, even with permission', async () => {
    const user = userEvent.setup()
    render(<CandidatesBulkBar {...baseProps()} count={3} canMerge onMerge={vi.fn()} />)
    await user.click(screen.getByText('bulk.actions'))
    expect(screen.queryByText('bulk.merge')).toBeNull()
  })

  it('hides Samenvoegen with exactly 2 selected but no delete permission', async () => {
    const user = userEvent.setup()
    render(<CandidatesBulkBar {...baseProps()} count={2} canMerge={false} onMerge={vi.fn()} />)
    await user.click(screen.getByText('bulk.actions'))
    expect(screen.queryByText('bulk.merge')).toBeNull()
  })

  it('shows Samenvoegen and fires onMerge with exactly 2 selected + permission', async () => {
    const user = userEvent.setup()
    const onMerge = vi.fn()
    render(<CandidatesBulkBar {...baseProps()} count={2} canMerge onMerge={onMerge} />)
    await user.click(screen.getByText('bulk.actions'))
    await user.click(screen.getByText('bulk.merge'))
    expect(onMerge).toHaveBeenCalledTimes(1)
  })
})
