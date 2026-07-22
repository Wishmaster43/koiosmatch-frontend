import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CandidatesToolbar from './CandidatesToolbar'

// CandidatesBulkBar (shown once ≥1 row is selected) fetches /pools on mount.
vi.mock('@/lib/api', () => ({ default: { get: vi.fn(() => Promise.resolve({ data: [] })) } }))

// i18n is not initialised in tests → t() returns the key, so assertions drive on keys.
const bulkBar = () => ({
  onAddToPool: vi.fn(), onRemoveFromPool: vi.fn(), onSetOwner: vi.fn(), onSetStage: vi.fn(),
  onSetTypes: vi.fn(), onSetConsent: vi.fn(), onConvertPhase: vi.fn(), onSetStatus: vi.fn(),
  onAddTag: vi.fn(), onRemoveTag: vi.fn(), onAddNote: vi.fn(), onArchive: vi.fn(), canArchive: true,
  onMerge: vi.fn(), canMerge: true, users: [], funnelTypes: [], candidateTypes: [], phases: [], statuses: [], selectedTags: [],
})
const baseProps = () => ({
  selectedCount: 0, onClearSelection: vi.fn(), bulkBar: bulkBar(),
  onAddOpen: vi.fn(), searchEpoch: 0, globalSearch: '', onSearch: vi.fn(),
  anyFilterActive: false, onClearFilters: vi.fn(),
  blacklistActive: false, onToggleBlacklist: vi.fn(),
  showArchived: false, onToggleArchived: vi.fn(),
  showTrash: false, onToggleTrash: vi.fn(),
  view: 'table' as const, onToggleView: vi.fn(),
})

// CandidatesToolbar — the row under the InsightsRow: bulk bar OR add/search/toggles
// (§0.3 split out of CandidatesPage, audit R1 item 1). Guards the branch switch and
// that every callback still reaches the right handler after the extraction.
describe('CandidatesToolbar', () => {
  it('shows the add/search/toggle row when nothing is selected', () => {
    render(<CandidatesToolbar {...baseProps()} />)
    expect(screen.getByText('+ page.add')).toBeInTheDocument()
    expect(screen.queryByText('bulk.actions')).toBeNull()
  })

  it('shows the bulk bar instead once rows are selected', async () => {
    render(<CandidatesToolbar {...baseProps()} selectedCount={2} />)
    expect(screen.queryByText('+ page.add')).toBeNull()
    expect(screen.getByText('bulk.actions')).toBeInTheDocument()
  })

  it('fires onAddOpen when the add button is clicked', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<CandidatesToolbar {...props} />)
    await user.click(screen.getByText('+ page.add'))
    expect(props.onAddOpen).toHaveBeenCalledTimes(1)
  })

  it('fires onToggleBlacklist from the quick-view toggle', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<CandidatesToolbar {...props} />)
    await user.click(screen.getByText('page.blacklistView'))
    expect(props.onToggleBlacklist).toHaveBeenCalledTimes(1)
  })

  // 11.1: the "manage by application" deep-link — CandidatesToolbar must forward
  // bulkBar.onManageByApplication straight through to CandidatesBulkBar (mirrors
  // how bulkGeocode/canGeocode were wired Page→Toolbar→BulkBar).
  it('threads onManageByApplication through to the bulk bar and fires it on click', async () => {
    const user = userEvent.setup()
    const onManageByApplication = vi.fn()
    const props = { ...baseProps(), selectedCount: 2, bulkBar: { ...bulkBar(), onManageByApplication } }
    render(<CandidatesToolbar {...props} />)
    await user.click(screen.getByText('bulk.actions'))
    await user.click(screen.getByText('bulk.manageByApplication'))
    expect(onManageByApplication).toHaveBeenCalledTimes(1)
  })

  it('hides the deep-link entry when the toolbar receives no onManageByApplication (honest gate)', async () => {
    const user = userEvent.setup()
    render(<CandidatesToolbar {...baseProps()} selectedCount={2} />)
    await user.click(screen.getByText('bulk.actions'))
    expect(screen.queryByText('bulk.manageByApplication')).toBeNull()
  })
})
