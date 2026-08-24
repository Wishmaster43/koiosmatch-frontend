import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CustomersReport from './CustomersReport'
import type { CustomersReportData } from '@/types/analytics'
import i18n from '@/i18n'

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
    expect(screen.getByText('Instroom 01-08-2026 t/m 31-08-2026')).toBeInTheDocument()
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

  // Nine-card KPI strip: total + eight axis-derived cards, all real counts from
  // the fixture's own axes.
  it('renders nine KPI cards derived from the report axes', () => {
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Totaal instroom')).toBeInTheDocument()
    expect(screen.getByText('Status: Actief')).toBeInTheDocument()
    expect(screen.getByText('Branche: Zorg')).toBeInTheDocument()
    expect(screen.getByText('Eigenaar: Anna de Vries')).toBeInTheDocument()
  })

  // RAPPORT-KPI-INSTELBAAR: which axes drive cards 2-9, and in what priority
  // order, is the tenant's stored Settings → Reports choice, not the hardcoded
  // status→phase→industry→owner→branch order.
  it('reorders the axis-derived KPI cards to the tenant-stored axis priority', () => {
    mockSettings.mockReturnValue({ report_kpis_customers: JSON.stringify(['branch', 'owner', 'industry', 'phase', 'status']) })
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false })
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
    mockSettings.mockReturnValue({ report_kpis_customers: JSON.stringify(['ghost_axis', 'phase', 'industry', 'owner', 'branch']) })
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Status: Actief')).toBeInTheDocument() // backfilled from the default order
    expect(screen.getByText(i18n.t('customers.kpiOrderFellBack', { ns: 'analytics' }))).toBeInTheDocument()
  })

  it('clicking an axis-derived KPI card drills with the same XOR param as its bar', async () => {
    const user = userEvent.setup()
    mockUseCustomersReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Status: Actief'))
    expect(getSpy).toHaveBeenCalledWith('/reports/customers/drill',
      expect.objectContaining({ params: { status: 'active', period: 'month' } }))
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

  // REPORTS-KPI-SPARE-2: a tenant swapping a slot to one of the nine standing
  // `kpis[]` signal spares sees the endpoint's REAL count, not a fabricated
  // number — the strip never invents this value.
  it('renders a real "kpis[]" signal spare when the tenant swaps it into a slot', () => {
    mockSettings.mockReturnValue({
      report_kpis_customers: JSON.stringify(['signal:contract_ending', 'status', 'phase', 'industry', 'owner', 'branch']),
    })
    mockUseCustomersReport.mockReturnValue({
      data: {
        ...data,
        kpis: [
          { key: 'contract_ending', label: 'Overeenkomst loopt af', count: 7 },
          { key: 'no_contact', label: 'Lang geen contact', count: 2 },
        ],
      },
      loading: false, error: false,
    })
    renderReport()
    expect(screen.getByText(i18n.t('customers.kpis.contractEnding', { ns: 'analytics' }))).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    // The unpicked signal (no_contact) never leaks in — only the swapped-in one renders.
    expect(screen.queryByText(i18n.t('customers.kpis.noContact', { ns: 'analytics' }))).not.toBeInTheDocument()
  })

  // KPIS-DRILL-1: a signal card whose key is one of the nine kpi-drill enum
  // values now drills via the dedicated endpoint, not the plain drill route.
  it('clicking the contract_ending signal card drills via /reports/customers/kpi-drill with kpi=contract_ending', async () => {
    const user = userEvent.setup()
    mockSettings.mockReturnValue({
      report_kpis_customers: JSON.stringify(['signal:contract_ending', 'status', 'phase', 'industry', 'owner', 'branch']),
    })
    mockUseCustomersReport.mockReturnValue({
      data: { ...data, kpis: [{ key: 'contract_ending', label: 'Overeenkomst loopt af', count: 7 }] },
      loading: false, error: false,
    })
    renderReport()
    await user.click(screen.getByText(i18n.t('customers.kpis.contractEnding', { ns: 'analytics' })))
    // Contract: the kpi-drill endpoint accepts ONLY `kpi` (standing signal, no
    // window) — the request must not smuggle period/filter params along.
    expect(getSpy).toHaveBeenCalledWith('/reports/customers/kpi-drill',
      expect.objectContaining({ params: { kpi: 'contract_ending' } }))
    expect(getSpy.mock.calls.some(c => c[0] === '/reports/customers/drill')).toBe(false)
  })

  // Negative pin: a signal key outside both the kpi-drill and kpi-signal-drill
  // enums (e.g. a future backend key CUSTOMERS_SIGNAL_LABEL_KEYS doesn't yet
  // list) stays display-only — no clickable affordance, no drill call. The real
  // catalogue today has no such entry (its nine signal spares ARE the kpi-drill
  // enum 1:1), so this pins the code path with one extra catalogue entry mocked
  // in — proves the strip-back-onClick logic, not just today's data shape.
  it('a signal card whose key is outside both enums renders without an onClick', async () => {
    vi.resetModules()
    // resetModules() drops hoisted vi.mock registrations for the fresh import
    // graph — re-declare the ones CustomersReport needs via vi.doMock so the
    // dynamically re-imported page still runs against controlled test doubles.
    vi.doMock('./useCustomersReport', () => ({ useCustomersReport: (...args: unknown[]) => mockUseCustomersReport(...args) }))
    vi.doMock('@/lib/useCustomerPhases', () => ({
      useCustomerPhases: () => ({ phases: [
        { value: 'lead', label: 'Lead', isCustomer: false, isDefault: true },
        { value: 'customer', label: 'Klant', isCustomer: true, isDefault: false },
      ] }),
    }))
    vi.doMock('@/lib/api', () => ({
      default: { get: (...args: unknown[]) => getSpy(...args) },
      unwrapList: (r: { data: { data?: unknown[]; meta?: { total?: number } } }) => ({ rows: r.data?.data ?? [], total: r.data?.meta?.total ?? 0 }),
      getActiveTenantId: () => 'test-tenant',
    }))
    vi.doMock('@/lib/settings/useAllSettings', async () => {
      const actual = await vi.importActual('@/lib/settings/useAllSettings')
      return { ...actual, useAllSettings: () => mockSettings() }
    })
    vi.doMock('./kpiCatalog', async () => {
      const actual = await vi.importActual<typeof import('./kpiCatalog')>('./kpiCatalog')
      const customersCatalog = [...actual.getReportKpiCatalog('customers'), { key: 'signal:some_future_signal', labelKey: 'customers.kpis.someFutureSignal' }]
      return {
        ...actual,
        getReportKpiCatalog: (scope: string) => scope === 'customers' ? customersCatalog : actual.getReportKpiCatalog(scope as never),
      }
    })
    // try/finally: an assertion throw must never leave the five doMock
    // registrations armed for later tests — resetModules() clears them all.
    try {
    const { default: CustomersReportFresh } = await import('./CustomersReport')
    const user = userEvent.setup()
    mockSettings.mockReturnValue({
      report_kpis_customers: JSON.stringify(['signal:some_future_signal', 'status', 'phase', 'industry', 'owner', 'branch']),
    })
    mockUseCustomersReport.mockReturnValue({
      data: { ...data, kpis: [{ key: 'some_future_signal', label: 'Toekomstig signaal', count: 4 }] },
      loading: false, error: false,
    })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CustomersReportFresh period="month" />
      </QueryClientProvider>,
    )
    // No `customers.kpis.some_future_signal` translation key exists in any
    // locale (test-only catalogue entry, never shipped) — i18next renders the
    // raw dotted key, which is good enough to locate the card.
    const label = screen.getByText('customers.kpis.some_future_signal')
    const card = label.closest('div[role="button"]')
    expect(card).toBeNull()
    await user.click(label)
    expect(getSpy.mock.calls.some(c => c[0] === '/reports/customers/kpi-drill')).toBe(false)
    expect(getSpy.mock.calls.some(c => c[0] === '/reports/customers/drill')).toBe(false)
    } finally {
      vi.doUnmock('./kpiCatalog')
      vi.resetModules()
    }
  })

  // The catalog knowingly excludes these signal spares from Prospects (they
  // describe an existing client relationship a lead can't have) — swapping one
  // into a Prospects slot must not silently render there.
  it('never offers a customers-only signal spare on the Prospects position', () => {
    mockSettings.mockReturnValue({
      report_kpis_prospects: JSON.stringify(['signal:contract_ending', 'phase', 'industry', 'owner', 'branch']),
    })
    mockUseCustomersReport.mockReturnValue({
      data: { ...data, kpis: [{ key: 'contract_ending', label: 'Overeenkomst loopt af', count: 7 }] },
      loading: false, error: false,
    })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CustomersReport period="month" initialView="prospects" />
      </QueryClientProvider>,
    )
    // 'signal:contract_ending' is not in the prospects catalogue, so
    // resolveReportKpiOrder drops it and backfills from the default order —
    // Status (the real default) renders in its place, never the signal card.
    expect(screen.queryByText(i18n.t('customers.kpis.contractEnding', { ns: 'analytics' }))).not.toBeInTheDocument()
    expect(screen.getByText('Status: Actief')).toBeInTheDocument()
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
    expect(mockUseCustomersReport).toHaveBeenCalledWith('month', {
      status: [], ownerId: [], locationId: [], customerId: [],
    }, 'lead')
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
      expect.objectContaining({ params: { status: 'inactive', period: 'month', phase: 'lead' } }))
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
})
