/**
 * MatchesPage · MATCH-APPROVAL-QUEUE-1 (Danny: managers had no list of matches
 * waiting on their own review — approval_status already rode on every row).
 * The "Te beoordelen" quick-view toggle + KPI tile both filter/count the
 * already-loaded rows CLIENT-SIDE (mirrors kpiScored/kpiUnscored — measured:
 * those two toggles never round-trip to the server on their own, `pageSize`
 * is the only thing that does), and both are honesty-gated on the tenant's
 * approval_mode setting (goedkeuring-badge-eerlijk) — absent entirely once
 * it is 'uit', never a permanent 0-tile.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { __resetPageMemoryForTests } from '@/lib/usePageMemory'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@/i18n'
import i18n from '@/i18n'
import MatchesPage from './MatchesPage'

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: {}, hasPermission: () => true }) }))
vi.mock('@/context/RightPanelContext', () => ({ useRightPanel: () => ({ registerFilters: vi.fn(), unregisterFilters: vi.fn() }) }))
vi.mock('@/lib/useMatchStatuses', () => ({ useMatchStatuses: () => ({ statuses: [], metaOf: () => undefined }) }))

// The tenant's approval_mode setting under test — overridden per test to prove
// the honesty gate (goedkeuring-badge-eerlijk, mirrors MatchApprovalBadge's own gate).
const mockApprovalMode = vi.fn()
vi.mock('./hooks/useMatchApprovalMode', () => ({ useMatchApprovalMode: () => mockApprovalMode() }))

// One pending, one already-approved row — enough to prove the toggle/KPI narrow
// to exactly the pending one.
const rows = [
  { id: 'm-1', candidate: 'Jane Doe', vacancy: 'Verpleegkundige', client: 'Acme', owner: 'Jane', status: 'open', approval_status: 'pending', archived: false },
  { id: 'm-2', candidate: 'John Roe', vacancy: 'Verzorgende IG', client: 'Beta', owner: 'John', status: 'open', approval_status: 'approved', archived: false },
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

// Captures the kpis InsightsRow receives — proves the tile's presence/count/
// click-to-filter wiring without depending on InsightsRow's own rendering.
type KpiCapture = { key: string; value?: unknown; active?: boolean; onClick?: () => void }
let lastKpis: KpiCapture[] = []
vi.mock('@/components/insights/InsightsRow', () => ({
  default: ({ kpis }: { kpis: KpiCapture[] }) => { lastKpis = kpis; return null },
}))

vi.mock('./MatchesBoard', () => ({ default: () => null }))
vi.mock('./MatchesBulkBar', () => ({ default: () => null }))
vi.mock('@/components/ui/PaginationBar', () => ({ default: () => null, PAGE_SIZE_OPTIONS: [50, 100, 200, 300, 400, 500] }))
vi.mock('@/components/ui/HeaderSearch', () => ({ default: () => null }))
vi.mock('@/components/ui/ClearFiltersButton', () => ({ default: () => null }))
vi.mock('@/components/ui/ViewModeToggle', () => ({ default: () => null }))
vi.mock('@/pages/candidates/drawer/MatchModal', () => ({ default: () => null }))
vi.mock('@/components/ui/ViewSwitch', () => ({
  default: ({ views }: { views: Array<{ render: () => unknown }> }) => <>{views[0]?.render()}</>,
}))
vi.mock('./MatchDrawer', () => ({ default: () => null }))
// Captures the exact rows the page hands the table (mirrors MatchesPage.filterPanel.test.tsx).
vi.mock('./MatchesTable', () => ({
  default: ({ rows: tableRows }: { rows: Array<{ id: string }> }) => (
    <div data-testid="table-rows">{tableRows.map(r => r.id).join(',')}</div>
  ),
}))

beforeEach(() => { __resetPageMemoryForTests(); lastKpis = []; mockApprovalMode.mockReturnValue({ approvalMode: 'altijd' }) })

describe('MatchesPage · "Te beoordelen" quick-view toggle + KPI (MATCH-APPROVAL-QUEUE-1)', () => {
  it('shows the toggle, and clicking it narrows the table to the pending row only', async () => {
    const user = userEvent.setup()
    render(<MatchesPage />)
    await waitFor(() => expect(screen.getByTestId('table-rows')).toHaveTextContent('m-1,m-2'))

    const toggle = screen.getByRole('button', { name: i18n.t('matches:quickView.pendingApproval') })
    await user.click(toggle)
    await waitFor(() => expect(screen.getByTestId('table-rows')).toHaveTextContent(/^m-1$/))
  })

  it('counts exactly the pending rows on the KPI tile, and its onClick filters the same way', async () => {
    render(<MatchesPage />)
    await waitFor(() => expect(lastKpis.some(k => k.key === 'pendingApproval')).toBe(true))
    const kpi = lastKpis.find(k => k.key === 'pendingApproval')!
    expect(kpi.value).toBe(1)

    act(() => kpi.onClick?.())
    await waitFor(() => expect(screen.getByTestId('table-rows')).toHaveTextContent(/^m-1$/))
  })

  it('is absent (toggle AND KPI) once the tenant approval_mode is "uit" — never a permanent 0-tile', async () => {
    mockApprovalMode.mockReturnValue({ approvalMode: 'uit' })
    render(<MatchesPage />)
    await waitFor(() => expect(screen.getByTestId('table-rows')).toHaveTextContent('m-1,m-2'))

    expect(screen.queryByRole('button', { name: i18n.t('matches:quickView.pendingApproval') })).not.toBeInTheDocument()
    expect(lastKpis.some(k => k.key === 'pendingApproval')).toBe(false)
  })
})
