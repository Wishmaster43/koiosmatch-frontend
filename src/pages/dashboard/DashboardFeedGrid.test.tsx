/**
 * DASH-FEEDS-PACK-1 — the work-feed tiles share ONE grid, so a tile that hid
 * itself never leaves a hole beside its neighbour.
 *
 * The defect this pins (Danny 17-08, measured on his own dashboard before the
 * fix): "Werk af" sat alone at y=1358 with its right half empty, and
 * "Stilstaande leads" sat alone at y=2020 with its right half empty, because the
 * six tiles lived in TWO hardcoded two-column grids with other sections between
 * them and every tile `return null`s on empty data. Adjacency is therefore a
 * property of the DOM structure, not of styling, and that is what is asserted:
 * same parent, and the two work-lists first so they pair up in row one no matter
 * which of the tiles below them have data.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: unknown) => String(v) }) }))
vi.mock('./hooks/useDashboardFilterState', () => ({
  useDashboardFilterState: () => ({
    selPeriode: 'month', setSelPeriode: vi.fn(), selVestiging: null, setSelVestiging: vi.fn(),
    selStatus: null, setSelStatus: vi.fn(), dashFilterParams: {},
  }),
}))
vi.mock('./hooks/useDashboardFilterPanel', () => ({ useDashboardFilterPanel: () => {} }))

// Every tile is visible per the template; which ones actually RENDER is decided
// by their own empty-check, exactly as in the app.
vi.mock('./hooks/useDashboardViewModel', () => ({
  useDashboardViewModel: () => ({
    vis: () => true, statusData: [], recruiterData: [], funnelData: [], oppStageData: [],
    recentCandidates: [], recentApplications: [], recentLeads: [], runs: [], conversations: [],
    showRuns: false, showConv: false, trendData: [], trendSeries: [], att: {}, kpis: [],
    // Only the stale-leads feed has data — the other three widget feeds are empty
    // and self-hide, which is the situation that used to leave the holes.
    expiringMatchesRows: [], staleVacanciesRows: [], koiosSuggestionsRows: [],
    customersByOwnerRows: [],
    staleLeadsRows: [{ id: 'l1', title: 'Lead zonder opvolging', sub: '12 dagen' }],
  }),
}))
vi.mock('./blocks/DistributionCharts', () => ({ default: () => null }))
vi.mock('./blocks/TrendsRow', () => ({ default: () => null }))
vi.mock('./blocks/RecentListsRow', () => ({ default: () => null }))
vi.mock('./blocks/ActivityListsRow', () => ({ default: () => null }))
vi.mock('./blocks/ShiftsSummary', () => ({ default: () => null }))
vi.mock('./blocks/TouchpointsFeed', () => ({ default: () => null }))
vi.mock('./KoiosForYouCard', () => ({ default: () => null }))
// The real WidgetListBlock keeps its own empty-hiding, which is the behaviour
// under test; only "Werk af" is stubbed, since it needs live group data.
vi.mock('./blocks/AttentionCandidates', () => ({ default: () => <div data-testid="attention">block.attentionTitle</div> }))

vi.mock('./hooks/useDashboardData', () => ({
  useDashboardData: () => ({
    stats: null, opp: null, dash: null, dashCharts: null, matchesTotal: null, vacanciesTotal: null,
    loading: false, error: false, retry: vi.fn(),
  }),
}))

describe('Dashboard work-feed grid (DASH-FEEDS-PACK-1)', () => {
  it('makes Stilstaande leads the cell right after Werk af, with no hole between them', () => {
    render(<Dashboard />)
    const attention = screen.getByTestId('attention')
    const grid = attention.parentElement!
    // Two-column grid …
    expect(grid.style.display).toBe('grid')
    expect(grid.style.gridTemplateColumns).toBe('1fr 1fr')
    // … whose cells are exactly the two tiles that HAVE data, in that order.
    // The other four self-hid, and before this change that left the right half
    // of Werk af's row empty and pushed Stilstaande leads into its own grid two
    // sections lower. Comparing the children list is the honest assertion here:
    // jsdom computes no layout, so a coordinate check would pass on anything.
    const cells = Array.from(grid.children)
    expect(cells).toHaveLength(2)
    expect(cells[0]).toBe(attention)
    expect(cells[1].textContent).toContain('block.staleLeads')
  })
})
