/**
 * VacanciesPage — D1(a) dashboard-intent seam. §13: this asserts the DESTINATION
 * behaviour, not merely that a callback fired — arriving with the dashboard's
 * semantic { attention } intent must produce a real request param
 * (closing_soon=1 / stale_status=1) into the data layer, mirroring how
 * CandidatesPage:113 consumes { attention: 'stale6m' }.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { useState } from 'react'
import VacanciesPage from './VacanciesPage'

// Capture every filterParams object the data hook is called with — the real
// request the page would send to the server (list + stats both receive it).
const dataHookCalls: Array<Record<string, unknown>> = []

vi.mock('@/context/RightPanelContext', () => ({ useRightPanel: () => ({ registerFilters: vi.fn(), unregisterFilters: vi.fn() }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [] }) }))
vi.mock('@/lib/useBranchOptions', () => ({ useBranchOptions: () => [] }))
vi.mock('@/context/VacancyLookupsContext', () => ({
  VacancyLookupsProvider: ({ children }: { children: React.ReactNode }) => children,
  useVacancyLookups: () => ({ statuses: [], phases: [], statusMeta: () => ({ label: '', color: '#000' }) }),
}))
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ navigate: vi.fn() }), useOpenFromIntent: () => {} }))
vi.mock('@/hooks/useDrawerUrl', () => ({ useDrawerUrl: () => {} }))
// A real useState-backed stub — setAttention() must actually re-render the page
// with the new filterParams, a plain vi.fn() setter would leave the intent inert.
vi.mock('@/lib/usePageMemory', () => ({
  usePageMemory: (_k: string, initial: unknown) =>
    useState(typeof initial === 'function' ? (initial as () => unknown)() : initial),
}))
vi.mock('@/hooks/useListPageSize', () => ({ useListPageSize: () => ({ pageSize: 25, setPageSize: vi.fn(), options: [25] }) }))
vi.mock('./hooks/useVacanciesData', () => ({
  VACANCIES_MAX_PER_PAGE: 200,
  useVacanciesData: (args: { filterParams: Record<string, unknown> }) => {
    dataHookCalls.push(args.filterParams)
    return { vacancies: [], setVacancies: vi.fn(), loading: false, error: null, total: 0, setTotal: vi.fn(),
      lastPage: 1, stats: null, customers: [] }
  },
}))
vi.mock('./hooks/useVacancyRecord', () => ({
  useVacancyRecord: () => ({
    selected: null, detail: null, drawerExpanded: false, setDrawerExpanded: vi.fn(), closeDrawer: vi.fn(),
    selectVacancy: vi.fn(), handleCreated: vi.fn(), updateVacancy: vi.fn(), restoreVacancy: vi.fn(),
  }),
}))
vi.mock('./hooks/useVacancyInsights', () => ({
  useVacancyInsights: () => ({ statusData: [], ownerData: [], clientData: [], publishedData: [], categoryData: [], funnelData: [], agentData: [], applicationsTotal: 0 }),
}))
vi.mock('./hooks/useAiAgents', () => ({ useAiAgents: () => ({ options: [] }) }))
vi.mock('./hooks/useVacancyBulkActions', () => ({
  useVacancyBulkActions: () => ({ toggleRow: vi.fn(), toggleAll: vi.fn(), bulkSetOwner: vi.fn(), bulkSetStatus: vi.fn(),
    bulkSetClient: vi.fn(), bulkPublish: vi.fn(), bulkSetAiAgent: vi.fn(), bulkRemoveTag: vi.fn(), bulkAddNote: vi.fn(),
    bulkArchive: vi.fn(), selectedTags: [], dialog: null }),
}))
vi.mock('@/components/insights/InsightsRow', () => ({ default: () => null }))
vi.mock('./VacanciesTable', () => ({ default: () => null }))
vi.mock('./VacanciesBulkBar', () => ({ default: () => null }))
vi.mock('./VacancyDrawer', () => ({ default: () => null }))
vi.mock('./AddVacancyModal', () => ({ default: () => null }))
vi.mock('@/components/ui/PaginationBar', () => ({ default: () => null }))
vi.mock('@/components/ui/HeaderSearch', () => ({ default: () => null }))
vi.mock('@/components/ui/ClearFiltersButton', () => ({ default: () => null }))
vi.mock('@/components/ui/QuickViewToggle', () => ({ default: () => null }))
vi.mock('@/components/ui/ViewSwitch', () => ({ default: () => null }))
vi.mock('@/components/ui/ErrorBanner', () => ({ default: () => null }))
vi.mock('@/components/ui/ActionMessageBanner', () => ({ default: () => null }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

describe('VacanciesPage · D1(a) dashboard intent seam', () => {
  it('a closingSoon intent produces a closing_soon=1 request', () => {
    dataHookCalls.length = 0
    render(<VacanciesPage intent={{ attention: 'closingSoon' }} />)
    const last = dataHookCalls[dataHookCalls.length - 1]
    expect(last.closing_soon).toBe(1)
  })

  it('a staleStatus intent produces a stale_status=1 request', () => {
    dataHookCalls.length = 0
    render(<VacanciesPage intent={{ attention: 'staleStatus' }} />)
    const last = dataHookCalls[dataHookCalls.length - 1]
    expect(last.stale_status).toBe(1)
  })

  it('arriving with no intent sends neither attention filter', () => {
    dataHookCalls.length = 0
    render(<VacanciesPage />)
    const last = dataHookCalls[dataHookCalls.length - 1]
    expect(last.closing_soon).toBeUndefined()
    expect(last.stale_status).toBeUndefined()
  })
})
