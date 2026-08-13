/**
 * ApplicationsPage — D6 dashboard-intent seam. §13: this asserts the DESTINATION
 * behaviour, not merely that a callback fired — arriving with the dashboard's
 * semantic { attention } intent must produce a real request param
 * (too_long_in_stage=1 / missing_appointment=1) into the data layer, mirroring
 * how CandidatesPage:113 consumes { attention: 'stale6m' }.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { useState } from 'react'
import ApplicationsPage from './ApplicationsPage'

// Capture every filterParams object the data hook is called with — the real
// request the page would send to the server.
const dataHookCalls: Array<Record<string, unknown>> = []

vi.mock('@/context/RightPanelContext', () => ({ useRightPanel: () => ({ registerFilters: vi.fn(), unregisterFilters: vi.fn() }) }))
vi.mock('@/context/LookupsContext', () => ({ useLookups: () => ({ funnelTypes: [], funnelMeta: () => ({ label: '', color: '#000' }) }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [] }) }))
vi.mock('@/lib/useBranchOptions', () => ({ useBranchOptions: () => [] }))
vi.mock('@/context/NavigationContext', () => ({ useOpenFromIntent: () => {} }))
vi.mock('@/hooks/useDrawerUrl', () => ({ useDrawerUrl: () => {} }))
// A real useState-backed stub — setAttention() must actually re-render the page
// with the new filterParams, a plain vi.fn() setter would leave the intent inert.
vi.mock('@/lib/usePageMemory', () => ({
  usePageMemory: (_k: string, initial: unknown) =>
    useState(typeof initial === 'function' ? (initial as () => unknown)() : initial),
}))
vi.mock('@/hooks/useListPageSize', () => ({ useListPageSize: () => ({ pageSize: 25, setPageSize: vi.fn(), options: [25] }) }))
vi.mock('./hooks/useApplicationsData', () => ({
  APPLICATIONS_MAX_PER_PAGE: 200,
  useApplicationsData: (args: { filterParams: Record<string, unknown> }) => {
    dataHookCalls.push(args.filterParams)
    return { applications: [], setApplications: vi.fn(), loading: false, error: null, total: 0, setTotal: vi.fn(),
      lastPage: 1, wideRows: [], wideLoading: false, wideError: null, wideIsPartial: false, stats: null, statsFailed: false }
  },
}))
vi.mock('./hooks/useApplicationDrawerActions', () => ({
  useApplicationDrawerActions: () => ({
    selected: null, expanded: false, setExpanded: vi.fn(), closeDrawer: vi.fn(), selectApplication: vi.fn(),
    handleMove: vi.fn(), handleOwner: vi.fn(), handleLinkVacancy: vi.fn(), handleUpdateSource: vi.fn(),
    handleReject: vi.fn(), handleAdjustScore: vi.fn(), handleUpdateCustomFields: vi.fn(),
    handleCandidateUpdated: vi.fn(), handleDetach: vi.fn(), handleRestore: vi.fn(),
  }),
}))
vi.mock('./hooks/useApplicationBulkActions', () => ({
  useApplicationBulkActions: () => ({ toggleRow: vi.fn(), toggleAll: vi.fn(), bulkSetPhase: vi.fn(), bulkDetach: vi.fn() }),
}))
vi.mock('@/components/insights/InsightsRow', () => ({ default: () => null }))
vi.mock('./ApplicationsTable', () => ({ default: () => null }))
vi.mock('./ApplicationsBoard', () => ({ default: () => null }))
vi.mock('./ApplicationDrawer', () => ({ default: () => null }))
vi.mock('./ApplicationsBulkBar', () => ({ default: () => null }))
vi.mock('./AddApplicationModal', () => ({ default: () => null }))
vi.mock('@/components/ui/PaginationBar', () => ({ default: () => null }))
vi.mock('@/components/ui/HeaderSearch', () => ({ default: () => null }))
vi.mock('@/components/ui/ClearFiltersButton', () => ({ default: () => null }))
vi.mock('@/components/ui/QuickViewToggle', () => ({ default: () => null }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

describe('ApplicationsPage · D6 dashboard intent seam', () => {
  it('a tooLongInStage intent produces a too_long_in_stage=1 request', () => {
    dataHookCalls.length = 0
    render(<ApplicationsPage intent={{ attention: 'tooLongInStage' }} />)
    const last = dataHookCalls[dataHookCalls.length - 1]
    expect(last.too_long_in_stage).toBe(1)
  })

  it('a missingAppointment intent produces a missing_appointment=1 request', () => {
    dataHookCalls.length = 0
    render(<ApplicationsPage intent={{ attention: 'missingAppointment' }} />)
    const last = dataHookCalls[dataHookCalls.length - 1]
    expect(last.missing_appointment).toBe(1)
  })

  it('arriving with no intent sends neither attention filter', () => {
    dataHookCalls.length = 0
    render(<ApplicationsPage />)
    const last = dataHookCalls[dataHookCalls.length - 1]
    expect(last.too_long_in_stage).toBeUndefined()
    expect(last.missing_appointment).toBeUndefined()
  })
})
