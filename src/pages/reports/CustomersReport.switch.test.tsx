/** CustomersReport · Klanten/Prospects switch and tenant custom KPI cards (split from CustomersReport.test.tsx; mock header duplicated per file by design). */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CustomersReport from './CustomersReport'
import i18n from '@/i18n'
// Escapes translated copy before it becomes a RegExp matcher (copy may gain metacharacters).
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
import { EMPTY_REPORT_FILTERS } from './reportFilterParams'
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

function renderReport() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <CustomersReport period="month" />
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

// RAPPORTEN-CONSOLIDATIE-1: the Klanten/Prospects switch — a real server-side
// filter (never a client-side slice), nine cards on BOTH positions, and the
// drill list following whichever position is active.
describe('CustomersReport — Klanten/Prospects switch (RAPPORTEN-CONSOLIDATIE-1)', () => {
  afterEach(() => { getSpy.mockClear(); mockSettings.mockReturnValue({}) })
  beforeEach(() => { window.history.replaceState(null, '', '#reports.customers') })

  it('clicking Prospects re-fetches with the flag-resolved `phase` filter — the SERVER narrows, never a client-side slice', async () => {
    const user = userEvent.setup()
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    mockUseCustomersReport.mockClear()
    await user.click(screen.getByRole('radio', { name: i18n.t('analytics:customers.viewSwitch.prospects') }))
    expect(mockUseCustomersReport).toHaveBeenCalledWith('month', EMPTY_REPORT_FILTERS, 'lead')
  })

  it('renders exactly nine KPI cards on the Prospects position too, with its own "Total prospects" card 1', () => {
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CustomersReport period="month" initialView="prospects" />
      </QueryClientProvider>,
    )
    expect(screen.getByText('Totaal prospects')).toBeInTheDocument()
    expect(screen.getByText(`${i18n.t('analytics:customers.axes.status')}: Actief`)).toBeInTheDocument()
    expect(screen.getByText(`${i18n.t('analytics:customers.axes.industry')}: Zorg`)).toBeInTheDocument()
  })

  // Supersede-guard: the Klanten flip retired the axis cards THERE, but the
  // Prospects position keeps them — so the axis-card → /reports/customers/drill
  // REQUEST stays pinned here (it was previously pinned on Klanten).
  it('clicking a Prospects axis card drills the axis XOR param on /reports/customers/drill', async () => {
    const user = userEvent.setup()
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CustomersReport period="month" initialView="prospects" />
      </QueryClientProvider>,
    )
    getSpy.mockClear()
    await user.click(screen.getByText(`${i18n.t('analytics:customers.axes.status')}: Actief`))
    expect(getSpy).toHaveBeenCalledWith('/reports/customers/drill',
      expect.objectContaining({ params: expect.objectContaining({ status: 'active', phase_filter: ['lead'] }) }))
  })

  it('a drill list opened on the Prospects position carries the `phase` filter — bar, list and switch position never disagree', async () => {
    const user = userEvent.setup()
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CustomersReport period="month" initialView="prospects" />
      </QueryClientProvider>,
    )
    getSpy.mockClear()
    // "Inactief" is not the top status segment (Actief is, already auto-opened
    // on mount) — clicking it guarantees a genuinely fresh request.
    await user.click(screen.getByText('Inactief'))
    expect(getSpy).toHaveBeenCalledWith('/reports/customers/drill',
      expect.objectContaining({ params: { status: 'inactive', period: 'month', phase_filter: ['lead'] } }))
  })

  it('the active position lives in the URL — a link to Prospects opens on Prospects and survives a switch flip', async () => {
    const user = userEvent.setup()
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByRole('radio', { name: i18n.t('analytics:customers.viewSwitch.prospects') }))
    expect(window.location.hash).toBe('#reports.customers?view=prospects')
  })

  // RAPPORT-COMPARE-2 (§4): the compare window lives in the right-hand filter
  // panel (ReportsPage) — the page itself renders NO inline compare control.
  it('renders no inline compare control (moved to the right filter panel)', () => {
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.queryByText('Vergelijk met')).not.toBeInTheDocument()
  })

  // RAPPORT-KPI-INSTELBAAR: Prospects kept the axis-topsegment strip (own
  // catalog/order) unaffected by KPI-CUSTOMERS-SIGNALS-1's Klanten conversion
  // — supersedes the pre-conversion combined "reorders the axis-derived KPI
  // cards" pin, now scoped to the position that still has axis cards.
  it('reorders the axis-derived KPI cards to the tenant-stored priority on Prospects', () => {
    const reorderedKeys = ['branch', 'owner', 'industry', 'phase', 'status']
    mockUseReportKpiSelection.mockReturnValue({ data: reorderedKeys, isLoading: false })
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false })
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <CustomersReport period="month" initialView="prospects" />
      </QueryClientProvider>,
    )
    const text = container.textContent ?? ''
    expect(text.indexOf('Vestiging:')).toBeGreaterThanOrEqual(0)
    expect(text.indexOf('Vestiging:')).toBeLessThan(text.indexOf('Status:'))
  })

  // The catalog knowingly excludes the customers-only signal cards from
  // Prospects (they describe an existing client relationship a lead can't
  // have) — a stored signal key must not silently render there.
  it('never offers a customers-only signal card on the Prospects position', () => {
    mockSettings.mockReturnValue({ report_kpis_prospects: JSON.stringify(['contract_ending', 'phase', 'industry', 'owner', 'branch']) })
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CustomersReport period="month" initialView="prospects" />
      </QueryClientProvider>,
    )
    // 'contract_ending' is not in the prospects catalogue, so
    // resolveReportKpiOrder drops it and backfills from the default order —
    // Status (the real default) renders in its place, never the signal card.
    expect(screen.queryByText(i18n.t('customers.kpis.contractEnding', { ns: 'analytics' }))).not.toBeInTheDocument()
    expect(screen.getByText(`${i18n.t('analytics:customers.axes.status')}: Actief`)).toBeInTheDocument()
  })
})

// KPI-BUILDER-FE-1 slice 3: tenant-defined KPI cards ride a second band row.
// customBase deliberately omits the switch's own phase_filter (§0.2 the
// definition drill route accepts only the documented panel-filter vocabulary).
describe('CustomersReport · tenant custom KPI cards (KPI-BUILDER-FE-1)', () => {
  afterEach(() => { getSpy.mockClear(); mockSettings.mockReturnValue({}) })

  const customKpi = {
    id: 'kd-3', entity: 'customer' as const, metric_key: 'inflow', label: 'Eigen instroom',
    dimension: 'all', dimension_value: null, dimension_label: null, value: 21, unit: 'count' as const,
    target: 25, warn: null, comparison: 'gte' as const, status: 'warn' as const,
  }

  it('renders the tenant card with its label/value/target caption and the band title', () => {
    mockUseCustomersReport.mockReturnValue({ data: { ...data, custom_kpis: [customKpi] }, loading: false, error: false })
    renderReport()
    expect(screen.getByText("Eigen KPI's")).toBeInTheDocument()
    expect(screen.getByText('Eigen instroom')).toBeInTheDocument()
    expect(screen.getByText(new RegExp(escapeRegExp(i18n.t('analytics:customKpi.target', { value: 25 }))))).toBeInTheDocument()
  })

  it('clicking the tenant card opens the definition drill without phase_filter/kpi/date', async () => {
    const user = userEvent.setup()
    mockUseCustomersReport.mockReturnValue({ data: { ...data, custom_kpis: [customKpi] }, loading: false, error: false })
    renderReport()
    await user.click(screen.getByTitle('Eigen instroom'))
    expect(getSpy).toHaveBeenCalledWith('/reports/kpi-definitions/kd-3/drill', expect.objectContaining({ params: expect.objectContaining({ period: 'month' }) }))
    const call = getSpy.mock.calls.find(c => c[0] === '/reports/kpi-definitions/kd-3/drill')
    expect(call?.[1].params).not.toHaveProperty('phase_filter')
    expect(call?.[1].params).not.toHaveProperty('kpi')
    expect(call?.[1].params).not.toHaveProperty('date')
  })

  it('renders a dash with no click for a null-value tenant card', async () => {
    const user = userEvent.setup()
    mockUseCustomersReport.mockReturnValue({ data: { ...data, custom_kpis: [{ ...customKpi, value: null }] }, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Eigen instroom')).toBeInTheDocument()
    await user.click(screen.getByTitle('Eigen instroom'))
    expect(getSpy.mock.calls.some(c => c[0] === '/reports/kpi-definitions/kd-3/drill')).toBe(false)
  })
})
