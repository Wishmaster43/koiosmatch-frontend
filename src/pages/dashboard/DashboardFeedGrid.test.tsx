/**
 * DASH-FEEDS-PACK-1 — the work-feed tiles share ONE grid, so a tile that hid
 * itself never leaves a hole beside its neighbour.
 *
 * The defect this pins (Danny 17-08, measured on his own dashboard before the
 * fix): two tiles each sat alone in their own row with a hole beside them,
 * because they lived in TWO hardcoded two-column grids with other sections
 * between them and every tile `return null`s on empty data. Adjacency is
 * therefore a property of the DOM structure, not of styling, and that is what
 * is asserted: same parent, cells pack in declaration order.
 *
 * DASHBOARD-OPRUIMING-1 (Danny 23-08): "Werk af" (AttentionCandidates),
 * "Stilstaande leads" and "Vandaag" (TouchpointsFeed) are removed entirely —
 * their components are deleted and their JSX render call sites are gone from
 * Dashboard.tsx. `vis` is mocked to always return true below (the same shape
 * admin/management's '*' wildcard produces) specifically to prove that even
 * under a wildcard visibility predicate, the three removed titles never
 * render — the resilience has to live at the JSX call site, since the '*'
 * wildcard by design matches ANY id (§ measured map step 7).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Dashboard from './Dashboard'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ activeTenant: { id: 't1' }, dashboardType: () => 'management', hasModule: () => false }),
}))
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

// Every block is "visible" per the template (the '*' wildcard shape); which ones
// actually RENDER is decided by their own empty-check / by whether a JSX call
// site still exists for their id, exactly as in the app.
vi.mock('./hooks/useDashboardViewModel', () => ({
  useDashboardViewModel: () => ({
    vis: () => true, statusData: [], recruiterData: [], funnelData: [], oppStageData: [],
    recentCandidates: [], recentApplications: [], recentLeads: [], runs: [], conversations: [],
    showRuns: false, showConv: false, trendData: [], trendSeries: [], shifts: { open: null, occupancy: null }, kpis: [],
    // Only two of the three remaining widget feeds have data — koiosSuggestions
    // stays empty and self-hides, which is the situation that used to leave holes.
    expiringMatchesRows: [{ key: 'm1', primary: 'Aflopende match', meta: '01-09' }],
    staleVacanciesRows: [{ key: 'v1', primary: 'Stilstaande vacature', meta: '12 dagen' }],
    koiosSuggestionsRows: [],
    customersByOwnerRows: [],
  }),
}))
vi.mock('./blocks/DistributionCharts', () => ({ default: () => null }))
vi.mock('./blocks/TrendsRow', () => ({ default: () => null }))
vi.mock('./blocks/RecentListsRow', () => ({ default: () => null }))
vi.mock('./blocks/ActivityListsRow', () => ({ default: () => null }))
vi.mock('./blocks/ShiftsSummary', () => ({ default: () => null }))
vi.mock('./KoiosForYouCard', () => ({ default: () => null }))

vi.mock('./hooks/useDashboardData', () => ({
  useDashboardData: () => ({
    stats: null, opp: null, dash: null, dashCharts: null,
    loading: false, error: false, retry: vi.fn(),
  }),
}))

describe('Dashboard work-feed grid (DASH-FEEDS-PACK-1)', () => {
  it('packs the two tiles that have data into the same grid, with no hole between them', () => {
    render(<Dashboard />)
    const expiring = screen.getByText('Aflopende match')
    // DOM path: primary-text div → row div → WidgetListBlock's Block-outer div → grid.
    const grid = expiring.parentElement!.parentElement!.parentElement!.parentElement!
    // Two-column grid …
    expect(grid.style.display).toBe('grid')
    expect(grid.style.gridTemplateColumns).toBe('1fr 1fr')
    // … whose cells are exactly the two tiles that HAVE data. koiosSuggestions
    // self-hid (empty rows), so before this change that would have left the
    // second half of the row empty instead of packing.
    expect(grid.children).toHaveLength(2)
    expect(grid.textContent).toContain('Aflopende match')
    expect(grid.textContent).toContain('Stilstaande vacature')
  })

  // DASHBOARD-OPRUIMING-1 resilience pin (measured map step 7): `vis` above always
  // returns true — the exact shape admin/management's '*' wildcard produces — so
  // if a removed block's JSX call site had survived, it would render here. It
  // must not: the titles are gone from Dashboard.tsx, not merely hidden.
  it('never renders the three removed blocks, even under a wildcard-true visibility predicate', () => {
    render(<Dashboard />)
    expect(screen.queryByText('block.attentionTitle')).not.toBeInTheDocument()
    expect(screen.queryByText('block.staleLeads')).not.toBeInTheDocument()
    expect(screen.queryByText('block.touchpoints')).not.toBeInTheDocument()
  })
})
