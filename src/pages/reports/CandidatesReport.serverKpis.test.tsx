/** CandidatesReport · server lead_kpis strip (mock header duplicated per file by design). */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CandidatesReport from './CandidatesReport'
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
import i18n from '@/i18n'

describe('CandidatesReport · server lead_kpis strip (SERVER-KPIS-1)', () => {
  afterEach(() => { getSpy.mockClear() })
  beforeEach(() => { window.history.replaceState(null, '', '#reports.candidates') })
  const withKpis = { ...data, lead_kpis: { total: 41, stale_days_threshold: 30, stale_count: 7, by_branch: [{ value: 'amersfoort', label: 'Amersfoort', count: 9 }] } }
  // The InsightsRow tile: the label's parent holds label and value.
  const card = (label: string) => screen.getByText(label).parentElement as HTMLElement
  const open = () => render(<QueryClientProvider client={new QueryClient()}><CandidatesReport period="month" initialView="leads" /></QueryClientProvider>)

  it('renders total, the stale card with the days threshold as its caption and one branch card from lead_kpis', () => {
    mockUseCandidatesReport.mockReturnValue({ data: withKpis, loading: false, error: false })
    open()
    expect(screen.getByText(i18n.t('analytics:leads.total'))).toBeInTheDocument()
    expect(within(card(i18n.t('analytics:leads.total'))).getByText('41')).toBeInTheDocument()
    const stale = card(i18n.t('analytics:leads.kpis.stale'))
    expect(within(stale).getByText('7')).toBeInTheDocument()
    expect(within(stale).getByText(i18n.t('analytics:leads.kpis.staleThreshold', { days: 30 }))).toBeInTheDocument()
    expect(screen.getByText('Amersfoort')).toBeInTheDocument()
  })

  it('clicking total requests the candidates drill with the lead phase, and a branch card requests branch=amersfoort', async () => {
    const user = userEvent.setup()
    mockUseCandidatesReport.mockReturnValue({ data: withKpis, loading: false, error: false })
    open()
    getSpy.mockClear()
    await user.click(screen.getByText(i18n.t('analytics:leads.total')))
    expect(getSpy).toHaveBeenCalledWith('/reports/candidates/drill',
      expect.objectContaining({ params: expect.objectContaining({ phase: 'lead', phase_filter: ['lead'] }) }))
    getSpy.mockClear()
    await user.click(screen.getByText('Amersfoort'))
    expect(getSpy).toHaveBeenCalledWith('/reports/candidates/drill',
      expect.objectContaining({ params: expect.objectContaining({ branch: 'amersfoort' }) }))
  })

  it('without lead_kpis the old axis cards render', () => {
    mockUseCandidatesReport.mockReturnValue({ data, loading: false, error: false })
    open()
    expect(screen.getByText('Status: Beschikbaar')).toBeInTheDocument()
    expect(screen.getByText('Vestiging: Utrecht')).toBeInTheDocument()
  })
})
