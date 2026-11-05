/** CandidatesReport · tenant-defined KPI cards (split from CandidatesReport.test.tsx; mock header duplicated per file by design). */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CandidatesReport from './CandidatesReport'
import type { CandidatesReportData } from '@/types/analytics'
import { data, suiteCards } from './CandidatesReport.testKit'

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

// KPI-BUILDER-FE-1 §3.9/§3.11: tenant-defined KPI cards ride a second band row,
// customBase strips phase_filter (the definition drill route doesn't know it),
// and a click hits the definition route with only the accepted params.
describe('CandidatesReport — tenant-defined KPI cards (KPI-BUILDER-1)', () => {
  afterEach(() => {
    getSpy.mockReset()
    getSpy.mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
    mockSettings.mockReturnValue({})
    mockUseReportKpiSelection.mockReset()
    mockUseReportKpiSelection.mockImplementation(() => ({ data: suiteCards.map(c => c.key), isLoading: false }))
  })

  const customKpiData: CandidatesReportData = {
    ...data,
    custom_kpis: [{
      id: 'kd-1', entity: 'candidate', metric_key: 'new_in_period', label: 'Nieuwe kandidaten',
      dimension: 'all', dimension_value: null, dimension_label: null,
      value: 14, unit: 'count', target: 15, warn: null, comparison: 'gte', status: 'alert',
    }],
  }

  it('renders the tenant card in a second band row with a formatted value, target caption and band title', () => {
    mockUseCandidatesReport.mockReturnValue({ data: customKpiData, loading: false, error: false })
    renderReport()
    expect(screen.getByText("Eigen KPI's")).toBeInTheDocument()
    expect(screen.getByText('Nieuwe kandidaten')).toBeInTheDocument()
    expect(screen.getByText('14')).toBeInTheDocument()
    expect(screen.getByText('buiten doel · doel 15')).toBeInTheDocument()
  })

  it('clicking the tenant card hits the definition drill route with only the accepted params (never phase_filter/kpi/date)', async () => {
    const user = userEvent.setup()
    mockUseCandidatesReport.mockReturnValue({ data: customKpiData, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Nieuwe kandidaten'))
    const call = getSpy.mock.calls.find(c => c[0] === '/reports/kpi-definitions/kd-1/drill')
    expect(call).toBeDefined()
    const params = call?.[1]?.params as Record<string, unknown>
    expect(params.period).toBe('month')
    expect(params.kpi).toBeUndefined()
    expect(params.date).toBeUndefined()
    expect(params.phase_filter).toBeUndefined()
  })

  it('a null value renders a dash and stays unclickable (no request)', async () => {
    const nullValueData: CandidatesReportData = {
      ...data,
      custom_kpis: [{ ...customKpiData.custom_kpis![0], value: null }],
    }
    mockUseCandidatesReport.mockReturnValue({ data: nullValueData, loading: false, error: false })
    renderReport()
    const label = screen.getByText('Nieuwe kandidaten')
    const card = label.parentElement as HTMLElement
    expect(within(card).getByText('—')).toBeInTheDocument()
    await userEvent.click(card)
    expect(getSpy.mock.calls.find(c => c[0] === '/reports/kpi-definitions/kd-1/drill')).toBeUndefined()
  })

  it('an envelope without custom_kpis renders exactly as today (no extra band, no console.error)', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockUseCandidatesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.queryByText("Eigen KPI's")).not.toBeInTheDocument()
    expect(errorSpy).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})
