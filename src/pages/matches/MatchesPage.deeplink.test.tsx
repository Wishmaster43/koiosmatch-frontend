/**
 * MatchesPage · deep-link open (point 3, Danny's ten-point round: "hyperlink
 * open in nieuw tabblad werkt niet"). Diagnosis: the page already adopts
 * `useDrawerUrl` (NAV-BACK-1, commit fa672b82) — this test proves that wiring
 * actually opens the drawer for a fresh `?open=<id>` hash, the exact scenario a
 * new browser tab boots into (DashboardLayout reads the hash into `activePage`
 * on mount; this hook is what turns the REST of the URL — `?open=<id>` — into
 * an opened drawer). Every heavy child is stubbed so the test isolates the
 * useDrawerUrl → pendingOpenId → selected chain, not table/board rendering.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import MatchesPage from './MatchesPage'

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { default_per_page: 50 }, hasPermission: () => true }) }))
vi.mock('@/context/RightPanelContext', () => ({ useRightPanel: () => ({ registerFilters: vi.fn(), unregisterFilters: vi.fn() }) }))
vi.mock('@/lib/useMatchStatuses', () => ({ useMatchStatuses: () => ({ statuses: [], metaOf: () => undefined }) }))

// The fixed row set this page's own useMatches hook would normally fetch — the
// deep-linked id ('m-2') is already present, so the drawer opens WITHOUT the
// direct-fetch fallback firing.
const rows = [
  { id: 'm-1', candidate: 'Jane Doe', vacancy: 'Verpleegkundige', status: 'open' },
  { id: 'm-2', candidate: 'John Roe', vacancy: 'Verzorgende IG', status: 'open' },
]
vi.mock('./hooks/useMatches', () => ({
  useMatches: () => ({ rows, loading: false, error: false, updateMatch: vi.fn(), reload: vi.fn() }),
  mapMatch: (r: unknown) => r,
}))
vi.mock('./hooks/useMatchesBulkActions', () => ({
  useMatchesBulkActions: () => ({ toggleRow: vi.fn(), toggleAll: vi.fn(), bulkCoupleHelloFlex: vi.fn(), bulkCoupleShiftmanager: vi.fn() }),
}))
vi.mock('./hooks/useMatchArchive', () => ({ useMatchArchive: () => ({ archiveMatch: vi.fn(), restoreMatch: vi.fn(), dialog: null }) }))
vi.mock('./hooks/useMatchMutations', () => ({ useMatchMutations: () => ({ setStatus: vi.fn(), setOwner: vi.fn(), updateCustomFields: vi.fn() }) }))

// Every other child is chrome unrelated to the deep-link seam — stubbed so the
// test never depends on DataTable/board internals or real i18n copy.
vi.mock('@/components/insights/InsightsRow', () => ({ default: () => null }))
vi.mock('./MatchesTable', () => ({ default: () => null }))
vi.mock('./MatchesBoard', () => ({ default: () => null }))
vi.mock('./MatchesBulkBar', () => ({ default: () => null }))
// useListPageSize (MatchesPage's shared page-size hook) imports PAGE_SIZE_OPTIONS
// from this module, so the wholesale mock must still carry that named export.
vi.mock('@/components/ui/PaginationBar', () => ({ default: () => null, PAGE_SIZE_OPTIONS: [50, 100, 200, 300, 400, 500] }))
vi.mock('@/components/ui/HeaderSearch', () => ({ default: () => null }))
vi.mock('@/components/ui/ClearFiltersButton', () => ({ default: () => null }))
vi.mock('@/components/ui/QuickViewToggle', () => ({ default: () => null }))
vi.mock('@/components/ui/ViewModeToggle', () => ({ default: () => null }))
vi.mock('@/pages/candidates/drawer/MatchModal', () => ({ default: () => null }))
// ViewSwitch normally keeps both views mounted — a bare render of the first
// view is enough here since both underlying views are themselves stubbed.
vi.mock('@/components/ui/ViewSwitch', () => ({
  default: ({ views }: { views: Array<{ render: () => unknown }> }) => <>{views[0]?.render()}</>,
}))
// Captures the `match` prop MatchesPage hands its drawer — the assertion target.
vi.mock('./MatchDrawer', () => ({
  default: ({ match }: { match: { id?: unknown } | null }) => <div data-testid="drawer-match">{match ? String(match.id) : ''}</div>,
}))

afterEach(() => { window.location.hash = '' })

describe('MatchesPage · deep-link open (?open=<id>)', () => {
  it('opens the matching row\'s drawer on a fresh mount with ?open= in the hash', async () => {
    window.location.hash = '#matches?open=m-2'
    render(<MatchesPage />)
    await waitFor(() => expect(screen.getByTestId('drawer-match')).toHaveTextContent('m-2'))
  })

  it('renders no open drawer when the hash carries no ?open= param', () => {
    window.location.hash = '#matches'
    render(<MatchesPage />)
    expect(screen.getByTestId('drawer-match')).toHaveTextContent('')
  })
})
