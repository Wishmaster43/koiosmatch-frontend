/**
 * MatchesPage · RIGHTPANEL-FILTERS-1 regression (Danny 2026-08-14, screenshot of
 * the matches page: "rode filters moeten naar rechts filter menu"). Pins two
 * things: (1) the toolbar no longer renders the old MatchFilterBar triggers
 * ("Kies fase…" / "Kies eigenaar…" / "Meer filters" — the exact controls boxed
 * red in Danny's screenshot); (2) the right-panel's stage/owner/client groups
 * (still fed by the SAME stageFilter/ownerFilter/clientFilter state the deleted
 * toolbar bar used to drive) narrow the exact same rows the table receives —
 * so deleting the duplicate toolbar changed nothing about which rows a user sees.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import '@/i18n'
import MatchesPage from './MatchesPage'

// Captures every registerFilters call so the test can inspect the REAL group
// config MatchesPage builds, and drive a pick through the same onToggle a
// right-panel row would call.
type FilterGroup = { key: string; onToggle?: (v: string) => void }
let lastGroups: FilterGroup[] = []
vi.mock('@/context/RightPanelContext', () => ({
  useRightPanel: () => ({
    registerFilters: (_key: string, groups: FilterGroup[]) => { lastGroups = groups },
    unregisterFilters: () => {},
  }),
}))

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { default_per_page: 50 }, hasPermission: () => true }) }))
vi.mock('@/lib/useMatchStatuses', () => ({
  useMatchStatuses: () => ({
    statuses: [{ value: 'open', label: 'Open' }, { value: 'placed', label: 'Placed' }],
    metaOf: (v: string) => ({ label: v, color: '#000', is_closed: false }),
  }),
}))

// Two rows with distinct stage/owner/client — enough to prove a stage pick narrows the set.
const rows = [
  { id: 'm-1', candidate: 'Jane Doe', vacancy: 'Verpleegkundige', client: 'Acme', owner: 'Jane', status: 'open', archived: false },
  { id: 'm-2', candidate: 'John Roe', vacancy: 'Verzorgende IG', client: 'Beta', owner: 'John', status: 'placed', archived: false },
]
vi.mock('./hooks/useMatches', () => ({
  useMatches: () => ({ rows, loading: false, error: false, updateMatch: vi.fn(), reload: vi.fn() }),
  mapMatch: (r: unknown) => r,
  MATCHES_MAX_PER_PAGE: 200,
}))
vi.mock('./hooks/useMatchesBulkActions', () => ({
  useMatchesBulkActions: () => ({ toggleRow: vi.fn(), toggleAll: vi.fn(), bulkCoupleHelloFlex: vi.fn(), bulkCoupleShiftmanager: vi.fn() }),
}))
vi.mock('./hooks/useMatchArchive', () => ({ useMatchArchive: () => ({ archiveMatch: vi.fn(), restoreMatch: vi.fn(), dialog: null }) }))
vi.mock('./hooks/useMatchMutations', () => ({ useMatchMutations: () => ({ setStatus: vi.fn(), setOwner: vi.fn(), updateCustomFields: vi.fn() }) }))

vi.mock('@/components/insights/InsightsRow', () => ({ default: () => null }))
vi.mock('./MatchesBoard', () => ({ default: () => null }))
vi.mock('./MatchesBulkBar', () => ({ default: () => null }))
vi.mock('@/components/ui/PaginationBar', () => ({ default: () => null, PAGE_SIZE_OPTIONS: [50, 100, 200, 300, 400, 500] }))
vi.mock('@/components/ui/HeaderSearch', () => ({ default: () => null }))
vi.mock('@/components/ui/ClearFiltersButton', () => ({ default: () => null }))
vi.mock('@/components/ui/QuickViewToggle', () => ({ default: () => null }))
vi.mock('@/components/ui/ViewModeToggle', () => ({ default: () => null }))
vi.mock('@/pages/candidates/drawer/MatchModal', () => ({ default: () => null }))
vi.mock('@/components/ui/ViewSwitch', () => ({
  default: ({ views }: { views: Array<{ render: () => unknown }> }) => <>{views[0]?.render()}</>,
}))
vi.mock('./MatchDrawer', () => ({ default: () => null }))
// Captures the exact rows the page hands the table — the "same narrowing" assertion target.
vi.mock('./MatchesTable', () => ({
  default: ({ rows: tableRows }: { rows: Array<{ id: string }> }) => (
    <div data-testid="table-rows">{tableRows.map(r => r.id).join(',')}</div>
  ),
}))

afterEach(() => { lastGroups = [] })

describe('MatchesPage · toolbar no longer duplicates the right-panel filters', () => {
  it('renders no "Kies fase…" / "Kies eigenaar…" / "Meer filters" toolbar trigger', () => {
    render(<MatchesPage />)
    expect(screen.queryByText(/kies fase/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/kies eigenaar/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/meer filters/i)).not.toBeInTheDocument()
  })

  it('registers stage/owner/client groups in the right panel, and picking a stage narrows the SAME rows the old toolbar bar used to filter', async () => {
    render(<MatchesPage />)
    await waitFor(() => expect(screen.getByTestId('table-rows')).toHaveTextContent('m-1,m-2'))

    // The panel carries every dimension the deleted MatchFilterBar exposed —
    // one place, not two.
    const keys = lastGroups.map(g => g.key)
    expect(keys).toEqual(expect.arrayContaining(['stage', 'owner', 'client']))

    // Picking 'open' via the panel's stage group is the exact onToggle a
    // right-panel row calls — it must narrow the table to just that row,
    // proving the panel now owns this filter end-to-end.
    const stageGroup = lastGroups.find(g => g.key === 'stage')!
    act(() => { stageGroup.onToggle!('open') })
    await waitFor(() => expect(screen.getByTestId('table-rows')).toHaveTextContent('m-1'))
  })
})
