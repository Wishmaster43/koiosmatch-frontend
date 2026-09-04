/**
 * MatchesPage · OPENERS-HIDE-1 — pins that the "+ add.button" direct-match
 * opener is hidden without matches.update (POST /matches is gated on
 * matches.update on the backend — there is no matches.create permission,
 * routes/api/tenant/applications-matches.php). Mock harness mirrors
 * MatchesPage.filterPanel.test.tsx.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import '@/i18n'
import MatchesPage from './MatchesPage'

vi.mock('@/context/RightPanelContext', () => ({
  useRightPanel: () => ({ registerFilters: () => {}, unregisterFilters: () => {} }),
}))

// hasPermission stubbed via a module-level flag so a test can flip it —
// mirrors CandidatesPage.createGate.test.tsx's idiom.
let canManage = true
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { default_per_page: 50 }, hasPermission: (p: string) => (p === 'matches.update' ? canManage : true) }),
}))
vi.mock('@/lib/useMatchStatuses', () => ({
  useMatchStatuses: () => ({
    statuses: [{ value: 'open', label: 'Open' }],
    metaOf: (v: string) => ({ label: v, color: '#000', is_closed: false }),
  }),
}))
vi.mock('./hooks/useMatchApprovalMode', () => ({ useMatchApprovalMode: () => ({ approvalMode: 'altijd' }) }))
vi.mock('./hooks/useMatches', () => ({
  useMatches: () => ({ rows: [], loading: false, error: false, updateMatch: vi.fn(), reload: vi.fn() }),
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
vi.mock('./MatchesTable', () => ({ default: () => <div data-testid="table-rows" /> }))

describe('MatchesPage · create gate (OPENERS-HIDE-1)', () => {
  beforeEach(() => { canManage = true })

  it('hides the "+ Nieuwe match" opener without matches.update', async () => {
    canManage = false
    render(<MatchesPage />)
    await waitFor(() => expect(screen.getByTestId('table-rows')).toBeInTheDocument())
    expect(screen.queryByText('Nieuwe match')).toBeNull()
  })

  it('shows the opener with matches.update', async () => {
    canManage = true
    render(<MatchesPage />)
    await waitFor(() => expect(screen.getByTestId('table-rows')).toBeInTheDocument())
    expect(screen.getByText('Nieuwe match')).toBeInTheDocument()
  })
})
