/**
 * VacanciesPage — D1(a) dashboard-intent seam. §13: this asserts the DESTINATION
 * behaviour, not merely that a callback fired — arriving with the dashboard's
 * semantic { attention } intent must produce a real request param
 * (closing_soon=1 / stale_status=1) into the data layer, mirroring how
 * CandidatesPage:113 consumes { attention: 'stale6m' }.
 */
import { describe, it, expect, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { useState } from 'react'
import VacanciesPage from './VacanciesPage'

// Capture every filterParams object the data hook is called with — the real
// request the page would send to the server (list + stats both receive it).
const dataHookCalls: Array<Record<string, unknown>> = []

interface FilterGroup { key: string; selected: string[]; onToggle: (v: string) => void }
let capturedGroups: FilterGroup[] = []
vi.mock('@/context/RightPanelContext', () => ({
  useRightPanel: () => ({ registerFilters: (_k: string, groups: FilterGroup[]) => { capturedGroups = groups }, unregisterFilters: vi.fn() }),
}))
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

  // VESTIGING-2: the ops fill-rate-by-branch tile's { branch } intent seeds
  // the selectedBranch filter, which reaches the request as branch_id[].
  it('a branch intent produces a branch_id request', () => {
    dataHookCalls.length = 0
    render(<VacanciesPage intent={{ branch: 'b1' }} />)
    const last = dataHookCalls[dataHookCalls.length - 1]
    expect(last.branch_id).toEqual(['b1'])
  })
})

// FILTER-PARITY-1: status/published/agent/has-applications/archived filter groups
// exist in the right panel and reach the real request params — the CLAUDE.md §13
// seam test (a mutation/request test, never only "a callback fired").
describe('VacanciesPage · filter-panel parity (status/published/agent/archived)', () => {
  it('registers the new filter groups and toggling published/archived reaches filterParams', () => {
    dataHookCalls.length = 0
    render(<VacanciesPage />)

    expect(capturedGroups.find(g => g.key === 'status')).toBeTruthy()
    expect(capturedGroups.find(g => g.key === 'published')).toBeTruthy()
    expect(capturedGroups.find(g => g.key === 'agent')).toBeTruthy()
    expect(capturedGroups.find(g => g.key === 'hasApplications')).toBeTruthy()
    expect(capturedGroups.find(g => g.key === 'archived')).toBeTruthy()
    expect(capturedGroups.find(g => g.key === 'geo')).toBeTruthy()
    // FILTERPANEEL-COMPLEET-1: owner/client/category/branch mirror the candidate
    // panel's organisation groups — all ten groups register on the vacancies panel.
    expect(capturedGroups.find(g => g.key === 'owner')).toBeTruthy()
    expect(capturedGroups.find(g => g.key === 'client')).toBeTruthy()
    expect(capturedGroups.find(g => g.key === 'category')).toBeTruthy()
    expect(capturedGroups.find(g => g.key === 'branch')).toBeTruthy()
    expect(capturedGroups).toHaveLength(10)
    // CONTIGUITY is the real invariant (Opus filterpaneel-verify): the sidebar
    // renders a heading whenever the category CHANGES, so a stranded group
    // paints a duplicate section header. Categories must never interleave.
    const cats = capturedGroups.map((g: { category?: string }) => g.category).filter(Boolean)
    const changes = cats.filter((c: string, i: number) => c !== cats[i - 1])
    expect(new Set(changes).size).toBe(changes.length)
    // And the canonical order holds: general → organisation → display.
    expect(changes).toEqual([...new Set(cats)])

    const publishedGroup = capturedGroups.find(g => g.key === 'published')!
    act(() => publishedGroup.onToggle('published'))
    let last = dataHookCalls[dataHookCalls.length - 1]
    expect(last.published).toBe(1)

    const archivedGroup = capturedGroups.find(g => g.key === 'archived')!
    act(() => archivedGroup.onToggle('archived'))
    last = dataHookCalls[dataHookCalls.length - 1]
    expect(last.include_archived).toBe(1)
  })
})
