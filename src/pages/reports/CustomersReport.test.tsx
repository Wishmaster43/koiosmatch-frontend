import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CustomersReport from './CustomersReport'
import type { CustomersReportData } from '@/types/analytics'
import i18n from '@/i18n'
import { EMPTY_REPORT_FILTERS } from './reportFilterParams'

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

// Tenant KPI-order settings (RAPPORT-KPI-INSTELBAAR) — empty blob = today's
// default order, unless a test overrides it.
const mockSettings = vi.hoisted(() => vi.fn(() => ({} as Record<string, unknown>)))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => mockSettings() }
})

const data: CustomersReportData = {
  period: 'month', from: '2026-08-01', to: '2026-08-31', total: 13,
  timeseries: { bucket: 'week', series: [{ date: '2026-08-03', label: 'Wk 32', value: 5 }, { date: '2026-08-10', label: 'Wk 33', value: 8 }] },
  // eslint-disable-next-line no-restricted-syntax -- NECESSITY: fixture seed data, not a component style
  by_status:  [{ value: 'active', label: 'Actief', color: '#16a34a', count: 9 }, { value: 'inactive', label: 'Inactief', color: '#dc2626', count: 3 },
               { value: 'zzz-deleted-status', label: 'Onbekend (verwijderde status)', color: null, count: 1 }],
  by_phase:   [{ value: 'lead', label: 'Lead', color: null, count: 4 }, { value: 'customer', label: 'Klant', color: null, count: 9 }],
  by_industry: [{ value: 'healthcare', label: 'Zorg', color: null, count: 13 }],
  by_owner:   [{ owner_id: 'u1', name: 'Anna de Vries', count: 9 }, { owner_id: 'none', name: 'Niet toegewezen', count: 4 }],
  by_branch:  [{ value: 'utrecht', label: 'Utrecht', color: null, count: 13 }],
  // KPI-CUSTOMERS-SIGNALS-1: the nine STANDING signal counts the Klanten strip
  // now reads verbatim — distinct values so a KPI-card assertion can never
  // accidentally match a different card's number.
  kpis: [
    { key: 'contract_ending', label: 'Overeenkomst loopt af', count: 7 },
    { key: 'no_contact', label: 'Lang geen contact', count: 2 },
    { key: 'task_overdue', label: 'Taak te laat', count: 11 },
    { key: 'price_agreement_ending', label: 'Prijsafspraak loopt af', count: 5 },
    { key: 'vacancy_stale', label: 'Vacature verouderd', count: 14 },
    { key: 'departments_without_placement', label: 'Afdelingen zonder plaatsing', count: 3 },
    { key: 'customers_without_vacancies', label: 'Klanten zonder vacatures', count: 6 },
    { key: 'customers_without_applications', label: 'Klanten zonder sollicitaties', count: 15 },
    { key: 'matches_stopped_early', label: 'Vroegtijdig gestopte matches', count: 12 },
  ],
}

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

describe('CustomersReport (RAPPORTEN-SUITE-1 portie 3, customers inflow report)', () => {
  // Every section now defaults its own list on mount, firing extra drill/advice
  // requests — clear the shared spy between tests so a later assertion never
  // matches a PRIOR test's leftover call history.
  afterEach(() => { getSpy.mockClear(); mockSettings.mockReturnValue({}) })

  it('shows the loading state', () => {
    mockUseCustomersReport.mockReturnValue({ data: null, loading: true, error: false })
    renderReport()
    expect(screen.getByText('Klanten laden…')).toBeInTheDocument()
  })

  it('shows the error state', () => {
    mockUseCustomersReport.mockReturnValue({ data: null, loading: false, error: true })
    renderReport()
    expect(screen.getByText('Kon de klanten niet laden')).toBeInTheDocument()
  })

  it('shows the empty state when there are no customers', () => {
    mockUseCustomersReport.mockReturnValue({
      data: { ...data, total: 0, by_status: [], by_phase: [], by_industry: [], by_owner: [], by_branch: [], timeseries: { bucket: 'week', series: [] } },
      loading: false, error: false,
    })
    renderReport()
    expect(screen.getByText('Geen klanten in deze periode')).toBeInTheDocument()
  })

  it('renders the axis bars on success', () => {
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Actief')).toBeInTheDocument()
    expect(screen.getByText('Klant')).toBeInTheDocument()
    expect(screen.getByText('Zorg')).toBeInTheDocument()
    expect(screen.getByText('Anna de Vries')).toBeInTheDocument()
    expect(screen.getByText('Utrecht')).toBeInTheDocument()
  })

  // BELANGRIJK per contract: the created_at window must be prominent, DD-MM-YYYY —
  // never ISO (CLAUDE.md §3B DATUM-1).
  it('renders the data window prominently as DD-MM-YYYY', () => {
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText(/Instroom 01-08-2026 t\/m 31-08-2026: \d+ nieuwe klanten/)).toBeInTheDocument()
    expect(screen.queryByText(/2026-08-01/)).not.toBeInTheDocument()
  })

  it('never renders a by_source axis and never invents a phase="none" sentinel bar', () => {
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.queryByText('Bron')).not.toBeInTheDocument()
    expect(screen.queryByText(/^none$/i)).not.toBeInTheDocument()
  })

  it('clicking a status bar drills with the status XOR param, never mixed with other axes', async () => {
    const user = userEvent.setup()
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Actief'))
    expect(getSpy).toHaveBeenCalledWith('/reports/customers/drill',
      expect.objectContaining({ params: { status: 'active', period: 'month' } }))
    expect(getSpy).toHaveBeenCalledWith('/reports/customers/advice',
      expect.objectContaining({ params: { status: 'active', period: 'month' } }))
  })

  // RAPPORT-GEZICHT-WAVE2: status is a coloured tenant lookup axis, so it now
  // renders as a donut — the click contract still carries the segment's `key`.
  it('clicking the phase donut segment drills with the phase XOR param', async () => {
    const user = userEvent.setup()
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Klant'))
    expect(getSpy).toHaveBeenCalledWith('/reports/customers/drill',
      expect.objectContaining({ params: { phase: 'customer', period: 'month' } }))
  })

  it('sends the active panel filters to BOTH the report hook and a drill click (RAPPORT-FILTERS-1 — bar and lade never disagree)', async () => {
    const user = userEvent.setup()
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false })
    const filters = { status: ['active'], ownerId: ['u1'], locationId: [7], customerId: [] }
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CustomersReport period="month" filters={filters} />
      </QueryClientProvider>,
    )
    // The report's own data hook received the exact same filter object — plus
    // the switch's own `phase` filter, `null` on the default Klanten position.
    expect(mockUseCustomersReport).toHaveBeenCalledWith('month', filters, null)
    // A drill click layers its XOR param ON TOP of those same filters, never instead of them.
    await user.click(screen.getByText('Klant'))
    expect(getSpy).toHaveBeenCalledWith('/reports/customers/drill', expect.objectContaining({
      params: { period: 'month', status: ['active'], owner_id: ['u1'], location_id: [7], phase: 'customer' },
    }))
  })

  it('clicking an industry bar drills with the industry XOR param', async () => {
    const user = userEvent.setup()
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Zorg'))
    expect(getSpy).toHaveBeenCalledWith('/reports/customers/drill',
      expect.objectContaining({ params: { industry: 'healthcare', period: 'month' } }))
  })

  it('clicking an owner bar drills with the owner XOR param (D2 shape: owner_id → owner)', async () => {
    const user = userEvent.setup()
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Anna de Vries'))
    expect(getSpy).toHaveBeenCalledWith('/reports/customers/drill',
      expect.objectContaining({ params: { owner: 'u1', period: 'month' } }))
  })

  it('clicking the "Niet toegewezen" owner row drills with owner=none', async () => {
    const user = userEvent.setup()
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Niet toegewezen'))
    expect(getSpy).toHaveBeenCalledWith('/reports/customers/drill',
      expect.objectContaining({ params: { owner: 'none', period: 'month' } }))
  })

  // Orphan-value drill (review-aanvulling): a deleted lookup row still renders its own
  // bar with the backend's "Onbekend (…)" label and drills on the RAW value, exactly
  // like any other segment — no special-casing needed in SegmentBars.
  it('renders an orphaned (deleted-lookup) status as its own bar and drills on the raw value', async () => {
    const user = userEvent.setup()
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Onbekend (verwijderde status)')).toBeInTheDocument()
    await user.click(screen.getByText('Onbekend (verwijderde status)'))
    expect(getSpy).toHaveBeenCalledWith('/reports/customers/drill',
      expect.objectContaining({ params: { status: 'zzz-deleted-status', period: 'month' } }))
  })

  // KPI-CUSTOMERS-SIGNALS-1 (supersedes the old axis-topsegment strip pin,
  // "renders nine KPI cards derived from the report axes"): Klanten's nine
  // cards ARE the report's own STANDING signal kpis[] suite, read verbatim —
  // no separate pinned "total" card any more (ReportKpiBand renders exactly
  // nine, mirrors OutreachReport/TasksReport's kpiByServerKey pin); the
  // windowed inflow total still renders in the prominent window line below.
  it('renders the nine standing signal KPI cards on Klanten', () => {
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText(i18n.t('customers.kpis.contractEnding', { ns: 'analytics' }))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('customers.kpis.matchesStoppedEarly', { ns: 'analytics' }))).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    // The five dropped axis-topsegment cards no longer render on Klanten (the
    // axes' own charts below still do — asserted separately below).
    expect(screen.queryByText('Status: Actief')).not.toBeInTheDocument()
    expect(screen.queryByText('Eigenaar: Anna de Vries')).not.toBeInTheDocument()
  })

  // RAPPORT-KPI-INSTELBAAR: which signal keys drive cards 2-9, and in what
  // priority order, is the tenant's stored Settings → Reports choice.
  it('reorders the signal KPI cards to the tenant-stored priority', () => {
    mockSettings.mockReturnValue({ report_kpis_customers: JSON.stringify([
      'matches_stopped_early', 'contract_ending', 'no_contact', 'task_overdue',
      'price_agreement_ending', 'vacancy_stale', 'departments_without_placement',
      'customers_without_vacancies', 'customers_without_applications',
    ]) })
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false })
    const { container } = renderReport()
    const text = container.textContent ?? ''
    const matchesStopped = i18n.t('customers.kpis.matchesStoppedEarly', { ns: 'analytics' })
    const contractEnding = i18n.t('customers.kpis.contractEnding', { ns: 'analytics' })
    expect(text.indexOf(matchesStopped)).toBeGreaterThanOrEqual(0)
    expect(text.indexOf(matchesStopped)).toBeLessThan(text.indexOf(contractEnding))
  })

  // A vanished stored signal key falls back to the default order silently on
  // the report (still the real nine cards, never a crash) but shows a notice.
  it('falls back a vanished stored signal key to the default and shows a notice', () => {
    mockSettings.mockReturnValue({ report_kpis_customers: JSON.stringify(['ghost_signal', 'contract_ending']) })
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText(i18n.t('customers.kpis.contractEnding', { ns: 'analytics' }))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('customers.kpiOrderFellBack', { ns: 'analytics' }))).toBeInTheDocument()
  })

  // A signal key the server omitted from its kpis[] response renders the house
  // dash with no clickable affordance — mirrors OutreachReport/TasksReport's
  // "missing key renders the house dash with no drill" contract.
  it('a signal card the server omitted renders the house dash with no onClick', () => {
    mockUseCustomersReport.mockReturnValue({
      data: { ...data, kpis: [{ key: 'contract_ending', label: 'Overeenkomst loopt af', count: 7 }] },
      loading: false, error: false,
    })
    renderReport()
    const label = screen.getByText(i18n.t('customers.kpis.noContact', { ns: 'analytics' }))
    expect(label.closest('div[role="button"]')).toBeNull()
  })

  it('clicking a week timeseries bar drills with date + bucket=week', async () => {
    const user = userEvent.setup()
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Wk 32'))
    expect(getSpy).toHaveBeenCalledWith('/reports/customers/drill',
      expect.objectContaining({ params: { date: '2026-08-03', bucket: 'week', period: 'month' } }))
  })

  it('omits bucket when the timeseries is day-granular', async () => {
    const user = userEvent.setup()
    mockUseCustomersReport.mockReturnValue({
      data: { ...data, timeseries: { bucket: 'day', series: [{ date: '2026-08-03', label: '03-08', value: 2 }] } },
      loading: false, error: false,
    })
    renderReport()
    await user.click(screen.getByText('03-08'))
    expect(getSpy).toHaveBeenCalledWith('/reports/customers/drill',
      expect.objectContaining({ params: { date: '2026-08-03', period: 'month' } }))
    const call = getSpy.mock.calls.find(c => c[0] === '/reports/customers/drill')
    expect(call?.[1].params).not.toHaveProperty('bucket')
  })

  // REPORTGRID-1: the shared drill drawer opens only on click, never
  // auto-defaulted on mount.
  it('never fires a drill request before any segment is clicked', () => {
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(getSpy).not.toHaveBeenCalled()
  })

  // Clicking a segment in ONE chart never changes another chart's list — each
  // section keeps its own independent drill state.
  it('clicking a segment in one chart never changes another chart\'s list', async () => {
    const user = userEvent.setup()
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    getSpy.mockClear()
    // "Inactief" is not the top status segment (Actief is), so it is guaranteed
    // to differ from the mount default and fire a fresh request.
    await user.click(screen.getByText('Inactief'))
    expect(getSpy).toHaveBeenCalledWith('/reports/customers/drill',
      expect.objectContaining({ params: { status: 'inactive', period: 'month' } }))
    // The industry section was never re-fetched by the status click.
    expect(getSpy).not.toHaveBeenCalledWith('/reports/customers/drill',
      expect.objectContaining({ params: expect.objectContaining({ industry: expect.anything() }) }))
  })

  // KPI-CUSTOMERS-SIGNALS-1 (supersedes the old "signal spare" pins): the
  // signal cards show the endpoint's REAL count, never a fabricated number —
  // this is now true by default on Klanten (no settings override needed, the
  // nine signals ARE the default catalog).
  it('shows the real server count for each signal card, never a fabricated number', () => {
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText(i18n.t('customers.kpis.contractEnding', { ns: 'analytics' }))).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  // KPIS-DRILL-1: a signal card drills via the dedicated kpi-drill endpoint,
  // not the plain drill route — no settings override needed, the nine signals
  // ARE the default Klanten catalog.
  it('clicking the contract_ending signal card drills via /reports/customers/kpi-drill with kpi=contract_ending', async () => {
    const user = userEvent.setup()
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText(i18n.t('customers.kpis.contractEnding', { ns: 'analytics' })))
    // Contract: the kpi-drill endpoint accepts ONLY `kpi` (standing signal, no
    // window) — the request must not smuggle period/filter params along.
    expect(getSpy).toHaveBeenCalledWith('/reports/customers/kpi-drill',
      expect.objectContaining({ params: { kpi: 'contract_ending' } }))
    expect(getSpy.mock.calls.some(c => c[0] === '/reports/customers/drill')).toBe(false)
  })
})

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
    await user.click(screen.getByRole('radio', { name: 'Prospects' }))
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
    expect(screen.getByText('Status: Actief')).toBeInTheDocument()
    expect(screen.getByText('Branche: Zorg')).toBeInTheDocument()
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
    await user.click(screen.getByText('Status: Actief'))
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
    await user.click(screen.getByRole('radio', { name: 'Prospects' }))
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
    mockSettings.mockReturnValue({ report_kpis_prospects: JSON.stringify(['branch', 'owner', 'industry', 'phase', 'status']) })
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
    expect(screen.getByText('Status: Actief')).toBeInTheDocument()
  })
})
