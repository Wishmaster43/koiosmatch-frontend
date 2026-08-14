import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CandidatesReport from './CandidatesReport'
import type { CandidatesReportData } from '@/types/analytics'
import i18n from '@/i18n'

// Data layer under test control (loading/error/empty/success — the four UI states).
const mockUseCandidatesReport = vi.fn()
vi.mock('./useCandidatesReport', () => ({ useCandidatesReport: (...args: unknown[]) => mockUseCandidatesReport(...args) }))

// Spy on the underlying axios client so we can assert the exact request shape
// (method/route/params) that a bar/bucket click sends — mutation tests must assert
// the request, never only that a callback fired (CLAUDE.md §13).
const getSpy = vi.fn().mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
vi.mock('@/lib/api', () => ({
  default: { get: (...args: unknown[]) => getSpy(...args) },
  unwrapList: (r: { data: { data?: unknown[]; meta?: { total?: number } } }) => ({ rows: r.data?.data ?? [], total: r.data?.meta?.total ?? 0 }),
  getActiveTenantId: () => 'test-tenant',
}))

// Tenant KPI-order settings (RAPPORT-KPI-INSTELBAAR) — empty blob = today's
// default axis order, unless a test overrides it.
const mockSettings = vi.hoisted(() => vi.fn(() => ({} as Record<string, unknown>)))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => mockSettings() }
})

const data: CandidatesReportData = {
  period: 'month', from: '2026-08-01', to: '2026-08-31', total: 12,
  timeseries: { bucket: 'week', series: [{ date: '2026-08-03', label: 'Wk 32', value: 5 }, { date: '2026-08-10', label: 'Wk 33', value: 7 }] },
  by_status:  [{ value: 'available', label: 'Beschikbaar', color: '#16a34a', count: 8 }, { value: 'placed', label: 'Geplaatst', color: '#2563eb', count: 4 }],
  by_phase:   [{ value: 'lead', label: 'Lead', color: null, count: 3 }, { value: 'candidate', label: 'Kandidaat', color: null, count: 9 }],
  by_source:  [{ value: 'referral', label: 'Referral', color: null, count: 6 }],
  by_owner:   [{ owner_id: 'u1', name: 'Anna de Vries', count: 8 }, { owner_id: 'none', name: 'Niet toegewezen', count: 4 }],
  by_branch:  [{ value: 'utrecht', label: 'Utrecht', color: null, count: 12 }],
}

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

describe('CandidatesReport (RAPPORTEN-SUITE-1 inflow report)', () => {
  // Every section now defaults its own list on mount, firing extra drill/advice
  // requests — clear the shared spy between tests so a later assertion never
  // matches a PRIOR test's leftover call history.
  afterEach(() => { getSpy.mockClear(); mockSettings.mockReturnValue({}) })

  it('shows the loading state', () => {
    mockUseCandidatesReport.mockReturnValue({ data: null, loading: true, error: false })
    renderReport()
    expect(screen.getByText('Instroom laden…')).toBeInTheDocument()
  })

  it('shows the error state', () => {
    mockUseCandidatesReport.mockReturnValue({ data: null, loading: false, error: true })
    renderReport()
    expect(screen.getByText('Kon de instroom niet laden')).toBeInTheDocument()
  })

  it('shows the empty state when there is no inflow', () => {
    mockUseCandidatesReport.mockReturnValue({ data: { ...data, total: 0, by_status: [], by_phase: [], by_source: [], by_owner: [], by_branch: [], timeseries: { bucket: 'week', series: [] } }, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Geen instroom in deze periode')).toBeInTheDocument()
  })

  it('renders the axis bars on success', () => {
    mockUseCandidatesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Beschikbaar')).toBeInTheDocument()
    expect(screen.getByText('Anna de Vries')).toBeInTheDocument()
    expect(screen.getByText('Utrecht')).toBeInTheDocument()
  })

  // BELANGRIJK per contract: the created_at window must be prominent, DD-MM-YYYY —
  // never ISO (CLAUDE.md §3B DATUM-1) — so "report ≠ list" never becomes a support ticket.
  it('renders the data window prominently as DD-MM-YYYY', () => {
    mockUseCandidatesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Instroom 01-08-2026 t/m 31-08-2026')).toBeInTheDocument()
    expect(screen.queryByText(/2026-08-01/)).not.toBeInTheDocument()
  })

  it('clicking a status bar drills with the status XOR param, never mixed with other axes', async () => {
    const user = userEvent.setup()
    mockUseCandidatesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Beschikbaar'))
    expect(getSpy).toHaveBeenCalledWith('/reports/candidates/drill',
      expect.objectContaining({ params: { status: 'available', period: 'month' } }))
    expect(getSpy).toHaveBeenCalledWith('/reports/candidates/advice',
      expect.objectContaining({ params: { status: 'available', period: 'month' } }))
  })

  it('sends the active panel filters to BOTH the report hook and a drill click (RAPPORT-FILTERS-1 — bar and lade never disagree)', async () => {
    const user = userEvent.setup()
    mockUseCandidatesReport.mockReturnValue({ data, loading: false, error: false })
    const filters = { status: ['available'], ownerId: ['u1'], locationId: [7], customerId: [] }
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CandidatesReport period="month" filters={filters} />
      </QueryClientProvider>,
    )
    // The report's own data hook received the exact same filter object.
    expect(mockUseCandidatesReport).toHaveBeenCalledWith('month', filters)
    // A drill click layers its XOR param ON TOP of those same filters, never instead of them.
    await user.click(screen.getByText('Kandidaat'))
    expect(getSpy).toHaveBeenCalledWith('/reports/candidates/drill', expect.objectContaining({
      params: { period: 'month', status: ['available'], owner_id: ['u1'], location_id: [7], phase: 'candidate' },
    }))
  })

  it('clicking an owner bar drills with the owner XOR param (D2 shape: owner_id → owner)', async () => {
    const user = userEvent.setup()
    mockUseCandidatesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Anna de Vries'))
    expect(getSpy).toHaveBeenCalledWith('/reports/candidates/drill',
      expect.objectContaining({ params: { owner: 'u1', period: 'month' } }))
  })

  // RETRO-CHECK (RAPPORTEN-SUITE-1 "portie 2" contract note): owner='none' (unassigned)
  // now also applies to /reports/candidates/drill — the sentinel row is a real,
  // clickable bar here too, not just on the applications report.
  it('clicking the "Niet toegewezen" owner row drills with owner=none', async () => {
    const user = userEvent.setup()
    mockUseCandidatesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Niet toegewezen'))
    expect(getSpy).toHaveBeenCalledWith('/reports/candidates/drill',
      expect.objectContaining({ params: { owner: 'none', period: 'month' } }))
  })

  // A week bucket click drills with date=<the bucket's machine key> + bucket=week, so
  // the drawer counts the WHOLE week — bar and drawer total always agree per contract.
  it('clicking a week timeseries bar drills with date + bucket=week', async () => {
    const user = userEvent.setup()
    mockUseCandidatesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Wk 32'))
    expect(getSpy).toHaveBeenCalledWith('/reports/candidates/drill',
      expect.objectContaining({ params: { date: '2026-08-03', bucket: 'week', period: 'month' } }))
  })

  // Nine-card KPI strip (Danny — same footprint as the dashboard): total + eight
  // axis-derived cards, all real counts from the fixture's own axes.
  it('renders nine KPI cards derived from the report axes', () => {
    mockUseCandidatesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Totaal ingestroomd')).toBeInTheDocument()
    expect(screen.getByText('Status: Beschikbaar')).toBeInTheDocument()
    expect(screen.getByText('Eigenaar: Anna de Vries')).toBeInTheDocument()
    expect(screen.getByText('Vestiging: Utrecht')).toBeInTheDocument()
  })

  // RAPPORT-KPI-INSTELBAAR: which axes drive cards 2-9, and in what priority
  // order, is the tenant's stored Settings → Reports choice, not the hardcoded
  // status→phase→source→owner→branch order.
  it('reorders the axis-derived KPI cards to the tenant-stored axis priority', () => {
    mockSettings.mockReturnValue({ report_kpis_candidates: JSON.stringify(['branch', 'owner', 'source', 'phase', 'status']) })
    mockUseCandidatesReport.mockReturnValue({ data, loading: false, error: false })
    const { container } = renderReport()
    const text = container.textContent ?? ''
    // "Vestiging" (branch) now leads the axis priority, so its card text appears
    // before "Status" — the reverse of the hardcoded default order.
    expect(text.indexOf('Vestiging:')).toBeGreaterThanOrEqual(0)
    expect(text.indexOf('Vestiging:')).toBeLessThan(text.indexOf('Status:'))
  })

  // A vanished stored axis key falls back to the default order silently on the
  // report (still nine real cards, never a crash) but shows a visible notice.
  it('falls back a vanished stored axis key to the default and shows a notice', () => {
    mockSettings.mockReturnValue({ report_kpis_candidates: JSON.stringify(['ghost_axis', 'phase', 'source', 'owner', 'branch']) })
    mockUseCandidatesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Status: Beschikbaar')).toBeInTheDocument() // backfilled from the default order
    expect(screen.getByText(i18n.t('candidates.kpiOrderFellBack', { ns: 'analytics' }))).toBeInTheDocument()
  })

  it('clicking an axis-derived KPI card drills with the same XOR param as its bar', async () => {
    const user = userEvent.setup()
    mockUseCandidatesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Status: Beschikbaar'))
    expect(getSpy).toHaveBeenCalledWith('/reports/candidates/drill',
      expect.objectContaining({ params: { status: 'available', period: 'month' } }))
  })

  // RAPPORTEN-DRILLLIST-1: every axis section shows its own always-visible list
  // beside the chart, seeded with a real request on mount — never a blank panel.
  it('renders a drill list beside each axis chart, defaulted on mount', async () => {
    mockUseCandidatesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    // The status axis's top segment (Beschikbaar, 8) seeds its own list on mount.
    expect(getSpy).toHaveBeenCalledWith('/reports/candidates/drill',
      expect.objectContaining({ params: { status: 'available', period: 'month' } }))
    // The owner axis independently seeds its own list with its own top segment.
    expect(getSpy).toHaveBeenCalledWith('/reports/candidates/drill',
      expect.objectContaining({ params: { owner: 'u1', period: 'month' } }))
  })

  it('omits bucket when the timeseries is day-granular', async () => {
    const user = userEvent.setup()
    mockUseCandidatesReport.mockReturnValue({
      data: { ...data, timeseries: { bucket: 'day', series: [{ date: '2026-08-03', label: '03-08', value: 2 }] } },
      loading: false, error: false,
    })
    renderReport()
    await user.click(screen.getByText('03-08'))
    expect(getSpy).toHaveBeenCalledWith('/reports/candidates/drill',
      expect.objectContaining({ params: { date: '2026-08-03', period: 'month' } }))
    const call = getSpy.mock.calls.find(c => c[0] === '/reports/candidates/drill')
    expect(call?.[1].params).not.toHaveProperty('bucket')
  })
})
