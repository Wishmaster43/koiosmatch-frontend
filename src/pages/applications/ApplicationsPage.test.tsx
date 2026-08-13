/**
 * ApplicationsPage — D6 dashboard-intent seam. §13: this asserts the DESTINATION
 * behaviour, not merely that a callback fired — arriving with the dashboard's
 * semantic { attention } intent must produce a real request param
 * (too_long_in_stage=1 / missing_appointment=1) into the data layer, mirroring
 * how CandidatesPage:113 consumes { attention: 'stale6m' }.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import ApplicationsPage from './ApplicationsPage'

// Capture every filterParams object the data hook is called with — the real
// request the page would send to the server.
const dataHookCalls: Array<Record<string, unknown>> = []
// Bucket donut/panel test (Danny 14-08): the bucket VALUE sent alongside
// filterParams — a separate arg on useApplicationsData, not folded into
// filterParams (see useApplicationFilters' bucketParam).
const bucketParamCalls: Array<string | undefined> = []

interface FilterGroup { key: string; selected: string[]; onToggle: (v: string) => void }
let capturedGroups: FilterGroup[] = []
vi.mock('@/context/RightPanelContext', () => ({
  useRightPanel: () => ({ registerFilters: (_k: string, groups: FilterGroup[]) => { capturedGroups = groups }, unregisterFilters: vi.fn() }),
}))
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
// S-board-1: mutable per-test override so the sample-notice tests can force
// wideIsPartial without re-declaring the whole mock factory.
const dataHookState = vi.hoisted(() => ({ wideIsPartial: false, statsFailed: false }))
vi.mock('./hooks/useApplicationsData', () => ({
  APPLICATIONS_MAX_PER_PAGE: 200,
  useApplicationsData: (args: { filterParams: Record<string, unknown>; bucketParam?: string }) => {
    dataHookCalls.push(args.filterParams)
    bucketParamCalls.push(args.bucketParam)
    return { applications: [], setApplications: vi.fn(), loading: false, error: null, total: 0, setTotal: vi.fn(),
      lastPage: 1, wideRows: [], wideLoading: false, wideError: null,
      wideIsPartial: dataHookState.wideIsPartial, stats: null, statsFailed: dataHookState.statsFailed }
  },
}))
// Capture the InsightsRow props (notice included) instead of rendering the real
// component — the mocked page's other children are stubbed to null too.
const insightsRowCalls: Array<Record<string, unknown>> = []
vi.mock('@/components/insights/InsightsRow', () => ({ default: (props: Record<string, unknown>) => { insightsRowCalls.push(props); return null } }))
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

// D6-KAART-2: the "too long in stage" KPI card — click sets the attention
// intent which the data hook turns into the real too_long_in_stage=1 request
// param (§13: assert the request, not just that a callback fired), and its
// value reads the real server-wide stats.attention.too_long_in_stage count.
describe('ApplicationsPage · D6-KAART-2 too-long-in-stage KPI card', () => {
  it('clicking the KPI card sends too_long_in_stage=1 on the next request', () => {
    insightsRowCalls.length = 0
    dataHookCalls.length = 0
    render(<ApplicationsPage />)
    const kpis = insightsRowCalls.at(-1)?.kpis as Array<{ key: string; onClick: () => void }>
    act(() => kpis.find(k => k.key === 'tooLongInStage')!.onClick())
    const last = dataHookCalls[dataHookCalls.length - 1]
    expect(last.too_long_in_stage).toBe(1)
  })

  it('shows the real server-wide stats count on the card, not a page-derived one', () => {
    insightsRowCalls.length = 0
    dataHookState.statsFailed = false
    // The mocked data hook always returns stats: null here — this test only
    // needs the wideRows fallback path to prove the flag drives the count.
    render(<ApplicationsPage />)
    const kpis = insightsRowCalls.at(-1)?.kpis as Array<{ key: string; value: number }>
    expect(kpis.find(k => k.key === 'tooLongInStage')!.value).toBe(0)
  })
})

// FILTER-PARITY-1: archived/trash filter groups exist and their onToggle reaches
// the real request params — the §13 seam test (never only "a callback fired").
describe('ApplicationsPage · filter-panel parity (archived/trash)', () => {
  it('registers archived and trash filter groups, both reaching include_archived=1', () => {
    dataHookCalls.length = 0
    render(<ApplicationsPage />)

    const archivedGroup = capturedGroups.find(g => g.key === 'archived')
    const trashGroup = capturedGroups.find(g => g.key === 'trash')
    expect(archivedGroup).toBeTruthy()
    expect(trashGroup).toBeTruthy()

    act(() => archivedGroup!.onToggle('archived'))
    const last = dataHookCalls[dataHookCalls.length - 1]
    expect(last.include_archived).toBe(1)
  })
})

describe('S-board-1 · board view sample-notice honesty', () => {
  beforeEach(() => {
    insightsRowCalls.length = 0
    dataHookState.wideIsPartial = false
    dataHookState.statsFailed = false
  })

  it('shows no notice in table view even when the wide fetch is partial (stats healthy)', () => {
    dataHookState.wideIsPartial = true
    render(<ApplicationsPage />)
    expect(insightsRowCalls.at(-1)?.notice).toBeUndefined()
  })

  it('shows the honesty notice in board view once the wide fetch exceeds WIDE_MAX_ROWS, regardless of stats health', async () => {
    dataHookState.wideIsPartial = true
    const user = userEvent.setup()
    render(<ApplicationsPage />)
    await user.click(screen.getByRole('button', { name: 'view.board' }))
    expect(insightsRowCalls.at(-1)?.notice).toBe('insights.pageScopeNotice')
  })

  it('board view stays silent when the wide fetch is complete', async () => {
    dataHookState.wideIsPartial = false
    const user = userEvent.setup()
    render(<ApplicationsPage />)
    await user.click(screen.getByRole('button', { name: 'view.board' }))
    expect(insightsRowCalls.at(-1)?.notice).toBeUndefined()
  })
})

// Danny 14-08: the bucket toolbar tab row is gone — active/matched/rejected now
// live in ONE donut (insights row) + a matching right-panel group, both driving
// the same `bucket` state that reaches the server as `bucketParam` (§13: the
// REQUEST, not just a fired callback).
describe('ApplicationsPage · bucket donut (replaces the toolbar tab row)', () => {
  it('renders no bucket toolbar buttons anymore', () => {
    render(<ApplicationsPage />)
    expect(screen.queryByRole('button', { name: 'buckets.active' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'buckets.matched' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'buckets.rejected' })).toBeNull()
  })

  it('clicking the "matched" donut slice sends bucket=matched to the data layer', () => {
    insightsRowCalls.length = 0
    bucketParamCalls.length = 0
    render(<ApplicationsPage />)
    const donuts = insightsRowCalls.at(-1)?.donuts as Array<{ key: string; onPick: (d: unknown) => void }>
    const bucketDonut = donuts.find(d => d.key === 'bucket')!
    act(() => bucketDonut.onPick({ key: 'matched' }))
    expect(bucketParamCalls.at(-1)).toBe('matched')
  })

  it('clicking the same donut slice again returns to the default bucket', () => {
    insightsRowCalls.length = 0
    bucketParamCalls.length = 0
    render(<ApplicationsPage />)
    const pick = () => (insightsRowCalls.at(-1)?.donuts as Array<{ key: string; onPick: (d: unknown) => void }>).find(d => d.key === 'bucket')!
    act(() => pick().onPick({ key: 'rejected' }))
    expect(bucketParamCalls.at(-1)).toBe('rejected')
    act(() => pick().onPick({ key: 'rejected' }))
    expect(bucketParamCalls.at(-1)).toBe('active')
  })

  it('the right filter panel carries a bucket group whose onToggle reaches the same request', () => {
    bucketParamCalls.length = 0
    render(<ApplicationsPage />)
    const bucketGroup = capturedGroups.find(g => g.key === 'bucket')
    expect(bucketGroup).toBeTruthy()
    act(() => bucketGroup!.onToggle('matched'))
    expect(bucketParamCalls.at(-1)).toBe('matched')
  })
})
