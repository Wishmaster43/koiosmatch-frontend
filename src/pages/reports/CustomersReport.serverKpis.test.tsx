/** CustomersReport · server prospect_kpis strip (mock header duplicated per file by design). */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CustomersReport from './CustomersReport'
import i18n from '@/i18n'
import { data } from './CustomersReport.testKit'

// Data layer under test control (loading/error/empty/success — the four UI states).
const mockUseCustomersReport = vi.fn()
vi.mock('./useCustomersReport', () => ({ useCustomersReport: (...args: unknown[]) => mockUseCustomersReport(...args) }))

// RAPPORTEN-CONSOLIDATIE-1: the Klanten/Prospects switch resolves its `phase`
// filter off the customer-phase lookup's `isCustomer` flag (never a hardcoded
// slug) — mirrors this file's own `by_phase` fixture ('lead'/'customer').
vi.mock('@/lib/useCustomerPhases', () => ({
  useCustomerPhases: () => ({
    phases: [
      { value: 'lead', label: 'Lead', isCustomer: false, isDefault: true },
      { value: 'customer', label: 'Klant', isCustomer: true, isDefault: false },
    ],
  }),
}))

// Spy on the underlying axios client so we can assert the exact request shape
// (method/route/params) that a bar/bucket click sends — mutation tests must assert
// the request, never only that a callback fired (CLAUDE.md §13).
const getSpy = vi.fn().mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
vi.mock('@/lib/api', () => ({
  default: { get: (...args: unknown[]) => getSpy(...args) },
  unwrapList: (r: { data: { data?: unknown[]; meta?: { total?: number } } }) => ({ rows: r.data?.data ?? [], total: r.data?.meta?.total ?? 0 }),
  getActiveTenantId: () => 'test-tenant',
}))

// Mock useReportKpiSelection hook to return default KPI order
const mockUseReportKpiSelection = vi.fn(() => ({ data: ['inflow', 'outflow', 'phase_conversion', 'no_followup', 'no_contact', 'no_cv', 'document_expiring', 'availability_due', 'active_conversations'] as string[], isLoading: false }))
vi.mock('./hooks/useReportKpiSelection', () => ({ useReportKpiSelection: () => mockUseReportKpiSelection() }))

// Tenant KPI-order settings (RAPPORT-KPI-INSTELBAAR) — empty blob = today's
// default order, unless a test overrides it.
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
// (donut: the datum incl. `key`; bar: the original ChartDatum). Mirrors
// CandidatesReport.test.tsx's stub 1:1.
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

describe('CustomersReport · server prospect_kpis strip (SERVER-KPIS-1)', () => {
  afterEach(() => { getSpy.mockClear() })
  beforeEach(() => { window.history.replaceState(null, '', '#reports.customers') })
  const withKpis = { ...data, prospect_kpis: {
    cards: [
      { key: 'customers_prospect', label: 'x', count: 21 },
      { key: 'prospects_no_contact', label: 'x', count: 5 },
      { key: 'prospects_task_overdue', label: 'x', count: 3 },
    ],
    by_branch: [{ value: 'amersfoort', label: 'Amersfoort', count: 9 }],
  } }
  const open = () => render(<QueryClientProvider client={new QueryClient()}><CustomersReport period="month" initialView="prospects" /></QueryClientProvider>)

  it('renders the three server cards by translated key plus the branch card', () => {
    mockUseCustomersReport.mockReturnValue({ data: withKpis, loading: false, error: false })
    open()
    expect(screen.getByText(i18n.t('analytics:prospects.total'))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('analytics:customers.kpis.prospectsNoContact'))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('analytics:customers.kpis.prospectsTaskOverdue'))).toBeInTheDocument()
    expect(screen.getByText('Amersfoort')).toBeInTheDocument()
  })

  // Screen probe 13-11: the BE's `none` bucket at 0 rendered as a ninth card 'Geen vestiging 0'; a
  // zero-count bucket never takes a slot (teller canon: a counter that says 0 renders nothing).
  it('skips a zero-count by_branch bucket and keeps the real branch card', () => {
    mockUseCustomersReport.mockReturnValue({ data: { ...withKpis, prospect_kpis: { ...withKpis.prospect_kpis,
      by_branch: [{ value: 'none', label: 'Geen vestiging', count: 0 }, { value: 'amersfoort', label: 'Amersfoort', count: 9 }] } }, loading: false, error: false })
    open()
    expect(screen.getByText('Amersfoort')).toBeInTheDocument()
    expect(screen.queryByText('Geen vestiging')).not.toBeInTheDocument()
  })

  it('clicking prospects_no_contact requests the signal drill with kpi=prospects_no_contact', async () => {
    const user = userEvent.setup()
    mockUseCustomersReport.mockReturnValue({ data: withKpis, loading: false, error: false })
    open()
    getSpy.mockClear()
    await user.click(screen.getByText(i18n.t('analytics:customers.kpis.prospectsNoContact')))
    expect(getSpy).toHaveBeenCalledWith('/reports/customers/kpi-signal-drill',
      expect.objectContaining({ params: expect.objectContaining({ kpi: 'prospects_no_contact' }) }))
    const params = getSpy.mock.calls.find(c => c[0] === '/reports/customers/kpi-signal-drill')?.[1]?.params as Record<string, unknown>
    // Window params ride along, phase_filter does not (the signal-drill request does not know it).
    expect(params).toHaveProperty('period')
    expect(params).not.toHaveProperty('phase_filter')
  })

  it('clicking a prospects branch card requests the customers drill with the branch and the prospects phase_filter', async () => {
    const user = userEvent.setup()
    mockUseCustomersReport.mockReturnValue({ data: withKpis, loading: false, error: false })
    open()
    getSpy.mockClear()
    await user.click(screen.getByText('Amersfoort'))
    expect(getSpy).toHaveBeenCalledWith('/reports/customers/drill',
      expect.objectContaining({ params: expect.objectContaining({ branch: 'amersfoort', phase_filter: expect.any(Array) }) }))
  })

  it('shows the strip for a standing signal even when the windowed prospect total is 0', () => {
    const standing = { ...withKpis, total: 0, prospect_kpis: { ...withKpis.prospect_kpis, cards: [
      { key: 'customers_prospect', label: 'x', count: 0 },
      { key: 'prospects_no_contact', label: 'x', count: 2 },
      { key: 'prospects_task_overdue', label: 'x', count: 0 },
    ], by_branch: [] } }
    mockUseCustomersReport.mockReturnValue({ data: standing, loading: false, error: false })
    open()
    expect(screen.getByText(i18n.t('analytics:customers.kpis.prospectsNoContact'))).toBeInTheDocument()
  })

  it('without prospect_kpis the old axis cards render', () => {
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false })
    open()
    expect(screen.getByText(`${i18n.t('analytics:customers.axes.status')}: Actief`)).toBeInTheDocument()
    expect(screen.queryByText(i18n.t('analytics:customers.kpis.prospectsNoContact'))).not.toBeInTheDocument()
  })
})
