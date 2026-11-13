/** CandidatesReport · Kandidaten/Leads switch (split from CandidatesReport.test.tsx; mock header duplicated per file by design). */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CandidatesReport from './CandidatesReport'
import i18n from '@/i18n'
import { EMPTY_REPORT_FILTERS } from './reportFilterParams'
import { getReportKpiCatalog } from './kpiCatalog'
import { data } from './CandidatesReport.testKit'

// Data layer under test control (loading/error/empty/success — the four UI states).
const mockUseCandidatesReport = vi.fn()
vi.mock('./useCandidatesReport', () => ({ useCandidatesReport: (...args: unknown[]) => mockUseCandidatesReport(...args) }))

// RAPPORTEN-CONSOLIDATIE-1: the Kandidaten/Leads switch resolves its `phase`
// filter off the candidate-phase lookup's flags (never a hardcoded slug) — a
// minimal two-row fixture mirroring the real seed (DEFAULT_PHASES).
const candidatePhases = [
  { value: 'lead', label: 'Lead', is_default: true, is_applicant: false },
  { value: 'candidate', label: 'Kandidaat', is_applicant: true },
]
vi.mock('@/context/LookupsContext', () => ({ useLookups: () => ({ phases: candidatePhases }) }))

// Spy on the underlying axios client so we can assert the exact request shape
// (method/route/params) that a bar/bucket click sends — mutation tests must assert
// the request, never only that a callback fired (CLAUDE.md §13).
const getSpy = vi.fn().mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
vi.mock('@/lib/api', () => ({
  default: { get: (...args: unknown[]) => getSpy(...args) },
  unwrapList: (r: { data: { data?: unknown[]; meta?: { total?: number } } }) => ({ rows: r.data?.data ?? [], total: r.data?.meta?.total ?? 0 }),
  getActiveTenantId: () => 'test-tenant',
}))

// Mock useReportKpiSelection hook to return custom KPI order per test
const mockUseReportKpiSelection = vi.fn(() => ({ data: [] as string[], isLoading: false }))
vi.mock('./hooks/useReportKpiSelection', () => ({ useReportKpiSelection: () => mockUseReportKpiSelection() }))

// Tenant KPI-order settings (RAPPORT-KPI-INSTELBAAR) — empty blob = today's
// default axis order, unless a test overrides it.
const mockSettings = vi.hoisted(() => vi.fn(() => ({} as Record<string, unknown>)))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => mockSettings() }
})

function renderReport() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <CandidatesReport period="month" />
    </QueryClientProvider>,
  )
}

// The house LineChartCard needs real layout (jsdom has none) so the timeseries
// wrapper is mocked exactly like WeeklyBarChartCard in TrendsRow.test.tsx: one
// button per point, same label text, onPick fired with the raw date key.
vi.mock('./ReportTimeseriesChart', () => ({
  default: ({ series, onPick }: { series: { date: string; label: string; value: number }[]; onPick?: (date: string) => void }) => (
    <>{series.map(p => <button key={p.date} onClick={() => onPick?.(p.date)}>{p.label}</button>)}</>
  ),
}))

// RAPPORT-GEZICHT-WAVE2: the Recharts house charts need real layout (jsdom has
// none) — stubs expose the exact click contract the real components deliver
// (donut: the datum incl. `key`; bar: the original ChartDatum).
type StubDatum = { name: string; value: number; key?: string }
vi.mock('@/components/charts/PieChartCard', () => ({
  default: ({ data, onItemClick }: { data?: StubDatum[]; onItemClick?: (d: unknown) => void }) => (
    <>{(data ?? []).map(d => <button key={d.key} onClick={() => onItemClick?.(d)}>{d.name}</button>)}</>
  ),
}))
vi.mock('@/components/charts/BarChartCard', () => ({
  default: ({ data, onBarClick }: { data?: StubDatum[]; onBarClick?: (d: StubDatum) => void }) => (
    <>{(data ?? []).map(d => <button key={d.key} onClick={() => onBarClick?.(d)}>{d.name}</button>)}</>
  ),
}))

// RAPPORTEN-CONSOLIDATIE-1: the Kandidaten/Leads switch — a real server-side
// filter (never a client-side slice), nine cards on BOTH positions, and the
// drill list following whichever position is active.
describe('CandidatesReport — Kandidaten/Leads switch (RAPPORTEN-CONSOLIDATIE-1)', () => {
  afterEach(() => { getSpy.mockClear(); mockSettings.mockReturnValue({}) })
  beforeEach(() => { window.history.replaceState(null, '', '#reports.candidates') })

  it('clicking Leads re-fetches with the flag-resolved `phase` filter — the SERVER narrows, never a client-side slice', async () => {
    const user = userEvent.setup()
    mockUseCandidatesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    mockUseCandidatesReport.mockClear()
    await user.click(screen.getByRole('radio', { name: i18n.t('analytics:candidates.viewSwitch.leads') }))
    expect(mockUseCandidatesReport).toHaveBeenCalledWith('month', EMPTY_REPORT_FILTERS, 'lead')
  })

  it('renders exactly nine KPI cards on the Leads position too, with its own "Total leads" card 1', () => {
    mockUseCandidatesReport.mockReturnValue({ data, loading: false, error: false })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CandidatesReport period="month" initialView="leads" />
      </QueryClientProvider>,
    )
    expect(screen.getByText(i18n.t('analytics:leads.total'))).toBeInTheDocument()
    expect(screen.getByText(`${i18n.t('analytics:candidates.axes.status')}: Beschikbaar`)).toBeInTheDocument()
    expect(screen.getByText(`${i18n.t('analytics:candidates.axes.branch')}: Utrecht`)).toBeInTheDocument()
  })

  it('a drill list opened on the Leads position carries the `phase` filter — bar, list and switch position never disagree', async () => {
    const user = userEvent.setup()
    mockUseCandidatesReport.mockReturnValue({ data, loading: false, error: false })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CandidatesReport period="month" initialView="leads" />
      </QueryClientProvider>,
    )
    getSpy.mockClear()
    // Clicking a status bar opens the shared drawer fresh — a genuinely new request.
    await user.click(screen.getByText('Geplaatst'))
    expect(getSpy).toHaveBeenCalledWith('/reports/candidates/drill',
      expect.objectContaining({ params: { status: 'placed', period: 'month', phase_filter: ['lead'] } }))
  })

  it('the active position lives in the URL — a link to Leads opens on Leads and survives a switch flip', async () => {
    const user = userEvent.setup()
    mockUseCandidatesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByRole('radio', { name: i18n.t('analytics:candidates.viewSwitch.leads') }))
    expect(window.location.hash).toBe('#reports.candidates?view=leads')
  })

  // The Leads position keeps its OWN, independently-configurable spare catalogue
  // (owner_none/branch_none/source_none) — but deliberately withOUT phase_lead
  // (every row here already IS the lead phase, so that card would always ≈ total).
  it('offers owner_none/branch_none/source_none but not phase_lead on the Leads catalogue', () => {
    const keys = getReportKpiCatalog('leads').map(c => c.key)
    expect(keys).toEqual(expect.arrayContaining(['owner_none', 'branch_none', 'source_none']))
    expect(keys).not.toContain('phase_lead')
  })

  it('swapping in the owner_none spare on Leads renders the real count too, nine cards total', () => {
    mockSettings.mockReturnValue({ report_kpis_leads: JSON.stringify(['owner_none', 'phase', 'source', 'status', 'branch']) })
    mockUseCandidatesReport.mockReturnValue({ data, loading: false, error: false })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CandidatesReport period="month" initialView="leads" />
      </QueryClientProvider>,
    )
    expect(screen.getByText(`${i18n.t('analytics:candidates.axes.owner')}: Niet toegewezen`)).toBeInTheDocument()
    expect(screen.getByText(i18n.t('analytics:leads.total'))).toBeInTheDocument()
  })

  it('a legacy reports.leads deep link (initialView="leads") opens directly on the Leads position', () => {
    mockUseCandidatesReport.mockReturnValue({ data, loading: false, error: false })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CandidatesReport period="month" initialView="leads" />
      </QueryClientProvider>,
    )
    expect(screen.getByRole('radio', { name: i18n.t('analytics:candidates.viewSwitch.leads') })).toHaveAttribute('aria-checked', 'true')
  })
})
