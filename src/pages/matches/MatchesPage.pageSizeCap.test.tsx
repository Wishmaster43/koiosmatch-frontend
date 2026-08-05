/**
 * MatchesPage · pageSize/serverCap honesty (seam-harness 2026-08-05): GET /matches
 * 422s above per_page=200 (MatchQuery::rules()) while useListPageSize's shared
 * dropdown offers sizes up to 500 and seeds straight from the tenant's
 * default_per_page preference. This renders the REAL useListPageSize +
 * useMatches wiring (only axios and unrelated UI chrome are mocked) with a
 * tenant preference of 500, and proves the outgoing GET /matches request still
 * asks for per_page=200 — MatchesPage's `useListPageSize('matches',
 * MATCHES_MAX_PER_PAGE)` wiring plus useMatches' own fixed fetch-all loop never
 * let a 500 preference leak into the real network call (§13: assert the request).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import MatchesPage from './MatchesPage'

// Tenant preference of 500 rows per page (AuthContext.user.default_per_page) — the
// exact "stored user preference" this test proves never reaches the network call.
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { default_per_page: 500 }, hasPermission: () => true }),
}))
vi.mock('@/context/RightPanelContext', () => ({ useRightPanel: () => ({ registerFilters: vi.fn(), unregisterFilters: vi.fn() }) }))
vi.mock('@/lib/useMatchStatuses', () => ({ useMatchStatuses: () => ({ statuses: [], metaOf: () => undefined }) }))

// The real GET /matches call under test — only the transport is mocked.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(() => Promise.resolve({ data: { data: [], meta: { last_page: 1 } } })) } }
})
import api from '@/lib/api'
const mockedGet = vi.mocked(api.get)

vi.mock('./hooks/useMatchesBulkActions', () => ({
  useMatchesBulkActions: () => ({ toggleRow: vi.fn(), toggleAll: vi.fn(), bulkCoupleHelloFlex: vi.fn(), bulkCoupleShiftmanager: vi.fn() }),
}))
vi.mock('./hooks/useMatchArchive', () => ({ useMatchArchive: () => ({ archiveMatch: vi.fn(), restoreMatch: vi.fn(), dialog: null }) }))
vi.mock('./hooks/useMatchMutations', () => ({ useMatchMutations: () => ({ setStatus: vi.fn(), setOwner: vi.fn(), updateCustomFields: vi.fn() }) }))

// Every other child is chrome unrelated to this seam — stubbed exactly like
// MatchesPage.deeplink.test.tsx so the test never depends on DataTable/board
// internals or real i18n copy, and the real useMatches/useListPageSize wiring
// is the only thing left doing actual work.
vi.mock('@/components/insights/InsightsRow', () => ({ default: () => null }))
vi.mock('./MatchesTable', () => ({ default: () => null }))
vi.mock('./MatchesBoard', () => ({ default: () => null }))
vi.mock('./MatchesBulkBar', () => ({ default: () => null }))
vi.mock('./MatchDrawer', () => ({ default: () => null }))
// useListPageSize (MatchesPage's shared page-size hook) imports PAGE_SIZE_OPTIONS
// from this module, so the wholesale mock must still carry that named export.
vi.mock('@/components/ui/PaginationBar', () => ({ default: () => null, PAGE_SIZE_OPTIONS: [50, 100, 200, 300, 400, 500] }))
vi.mock('@/components/ui/HeaderSearch', () => ({ default: () => null }))
vi.mock('@/components/ui/ClearFiltersButton', () => ({ default: () => null }))
vi.mock('@/components/ui/QuickViewToggle', () => ({ default: () => null }))
vi.mock('@/components/ui/ViewModeToggle', () => ({ default: () => null }))
vi.mock('@/pages/candidates/drawer/MatchModal', () => ({ default: () => null }))
vi.mock('@/components/ui/ViewSwitch', () => ({
  default: ({ views }: { views: Array<{ render: () => unknown }> }) => <>{views[0]?.render()}</>,
}))

afterEach(() => { window.location.hash = '' })

describe('MatchesPage · per_page honesty with a 500 stored preference', () => {
  it('requests per_page=200, never the tenant\'s stored 500 preference', async () => {
    render(<MatchesPage />)
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())
    const matchCall = mockedGet.mock.calls.find(c => c[0] === '/matches')
    expect(matchCall?.[1]?.params).toMatchObject({ per_page: 200 })
    expect(matchCall?.[1]?.params).not.toMatchObject({ per_page: 500 })
  })
})
