/**
 * Dashboard — regression test for the re-audit finding: a failed /candidates/stats
 * or /dashboard fetch used to render silently (no loading, no error state), so the
 * KPI strip showed "—" values that read as real zeros. This container now renders
 * the four UI states (§3) explicitly: loading / error+retry / success. Every
 * dependency this thin container wires is mocked — only the state-driven render
 * branches are under test, not the child blocks themselves.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Dashboard from './Dashboard'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ activeTenant: { id: 't1' }, dashboardType: () => 'management', hasModule: () => false }),
}))
vi.mock('@/lib/queries', () => ({ useCandidateCount: () => ({ data: 10, isLoading: false }) }))
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({ statusMeta: () => ({ label: '', color: '#000' }), funnelMeta: () => ({ label: '', color: '#000' }), funnelTypes: [] }),
}))
vi.mock('@/lib/settings/useAllSettings', () => ({
  useAllSettings: () => ({}),
  getJsonSetting: (_s: unknown, _k: string, def: unknown) => def,
  getBoolSetting: (_s: unknown, _k: string, def: boolean) => def,
}))
vi.mock('@/lib/formatters', () => ({ useNumberFormat: () => ({ formatNumber: (n: number) => String(n) }) }))
vi.mock('./hooks/useDashboardFilterState', () => ({
  useDashboardFilterState: () => ({
    selPeriode: 'month', setSelPeriode: vi.fn(), selVestiging: null, setSelVestiging: vi.fn(),
    selStatus: null, setSelStatus: vi.fn(), dashFilterParams: {},
  }),
}))
vi.mock('./hooks/useDashboardFilterPanel', () => ({ useDashboardFilterPanel: () => {} }))
vi.mock('./hooks/useDashboardViewModel', () => ({
  useDashboardViewModel: () => ({
    vis: () => false, statusData: [], recruiterData: [], funnelData: [], oppStageData: [],
    recentCandidates: [], recentApplications: [], recentLeads: [], runs: [], conversations: [],
    showRuns: false, showConv: false, trendData: [], trendSeries: [], att: {}, kpis: [],
  }),
}))
// Child blocks are out of scope for this container test (own components/tests).
vi.mock('./blocks/DistributionCharts', () => ({ default: () => null }))
vi.mock('./blocks/TrendsRow', () => ({ default: () => null }))
vi.mock('./blocks/RecentListsRow', () => ({ default: () => null }))
vi.mock('./blocks/ActivityListsRow', () => ({ default: () => null }))
vi.mock('./blocks/ShiftsSummary', () => ({ default: () => null }))
vi.mock('./blocks/TouchpointsFeed', () => ({ default: () => null }))
vi.mock('./blocks/AttentionCandidates', () => ({ default: () => null }))

const dashboardDataMock = vi.fn()
vi.mock('./hooks/useDashboardData', () => ({ useDashboardData: (...args: unknown[]) => dashboardDataMock(...args) }))

// The non-critical fields the hook also returns — held constant across the three states.
const baseData = { stats: null, opp: null, dash: null, dashCharts: null, matchesTotal: null, vacanciesTotal: null }

describe('Dashboard · four UI states (re-audit finding)', () => {
  it('renders the loading notice while the critical feeds are in flight', () => {
    dashboardDataMock.mockReturnValue({ ...baseData, loading: true, error: false, retry: vi.fn() })
    render(<Dashboard />)
    expect(screen.getByText('page.loading')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders a calm error notice with a working retry button when a critical feed fails', () => {
    const retry = vi.fn()
    dashboardDataMock.mockReturnValue({ ...baseData, loading: false, error: true, retry })
    render(<Dashboard />)
    expect(screen.getByRole('alert')).toHaveTextContent('page.loadError')
    fireEvent.click(screen.getByRole('button', { name: /error\.retry/ }))
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('renders the live dashboard (no loading/error notice) once both feeds succeed', () => {
    dashboardDataMock.mockReturnValue({ ...baseData, loading: false, error: false, retry: vi.fn() })
    render(<Dashboard />)
    expect(screen.queryByText('page.loading')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
