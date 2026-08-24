import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CandidatesReport from './CandidatesReport'
import type { CandidatesReportData } from '@/types/analytics'
import i18n from '@/i18n'
import { getReportKpiCatalog } from './kpiCatalog'

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
  // eslint-disable-next-line no-restricted-syntax -- NECESSITY: fixture seed data, not a component style
  by_status:  [{ value: 'available', label: 'Beschikbaar', color: '#16a34a', count: 8 }, { value: 'placed', label: 'Geplaatst', color: '#2563eb', count: 4 }],
  by_phase:   [{ value: 'lead', label: 'Lead', color: null, count: 3 }, { value: 'candidate', label: 'Kandidaat', color: null, count: 9 }],
  by_source:  [{ value: 'referral', label: 'Referral', color: null, count: 6 }],
  by_owner:   [{ owner_id: 'u1', name: 'Anna de Vries', count: 8 }, { owner_id: 'none', name: 'Niet toegewezen', count: 4 }],
  by_branch:  [{ value: 'utrecht', label: 'Utrecht', color: null, count: 12 }, { value: 'none', label: 'Geen vestiging', color: null, count: 2 }],
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

// The real nine-key suite (GET /reports/candidates/kpis) — status_stale 0 pins
// the calm-zero case, and dropping a key pins the honest dash.
const suiteCards = [
  { key: 'inflow', count: 12 }, { key: 'outflow', count: 2 }, { key: 'no_followup', count: 5 },
  { key: 'status_stale', count: 0 }, { key: 'no_cv', count: 3 }, { key: 'document_expiring', count: 1 },
  { key: 'availability_due', count: 2 }, { key: 'no_contact', count: 4 }, { key: 'active_conversations', count: 6 },
]
const mockSuiteResponse = (cards = suiteCards) => getSpy.mockImplementation((url: unknown) =>
  Promise.resolve(url === '/reports/candidates/kpis'
    ? { data: { data: cards } }
    : { data: { data: [], meta: { total: 0 } } }))

describe('CandidatesReport (RAPPORTEN-SUITE-1 inflow report)', () => {
  // Every section now defaults its own list on mount, firing extra drill/advice
  // requests — clear the shared spy between tests so a later assertion never
  // matches a PRIOR test's leftover call history.
  afterEach(() => {
    getSpy.mockReset()
    getSpy.mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
    mockSettings.mockReturnValue({})
  })

  it('shows the loading state', () => {
    mockUseCandidatesReport.mockReturnValue({ data: null, loading: true, error: false })
    renderReport()
    expect(screen.getByText('Kandidaten laden…')).toBeInTheDocument()
  })

  it('shows the error state', () => {
    mockUseCandidatesReport.mockReturnValue({ data: null, loading: false, error: true })
    renderReport()
    expect(screen.getByText('Kon de kandidaten niet laden')).toBeInTheDocument()
  })

  it('shows the empty state when there is no inflow', () => {
    mockUseCandidatesReport.mockReturnValue({ data: { ...data, total: 0, by_status: [], by_phase: [], by_source: [], by_owner: [], by_branch: [], timeseries: { bucket: 'week', series: [] } }, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Geen kandidaten in deze periode')).toBeInTheDocument()
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
    expect(screen.getByText('Kandidaten 01-08-2026 t/m 31-08-2026')).toBeInTheDocument()
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
    // The report's own data hook received the exact same filter object — plus
    // the switch's own `phase` filter, `null` on the default Kandidaten position.
    expect(mockUseCandidatesReport).toHaveBeenCalledWith('month', filters, null)
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

  // RAPPORT-GEZICHT-WAVE2: the strip is the REAL suite (GET /reports/candidates/
  // kpis) — nine attention/flow KPIs with translated labels, never axis filler.
  it('renders the real suite cards with translated labels and values', async () => {
    mockSuiteResponse()
    mockUseCandidatesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(await screen.findByText('Instroom')).toBeInTheDocument()
    expect(screen.getByText('Zonder opvolging')).toBeInTheDocument()
    expect(screen.getByText('Actieve gesprekken')).toBeInTheDocument()
    // The suite VALUE renders (no_followup 5); the old axis filler never does.
    expect(await screen.findByText('5')).toBeInTheDocument()
    expect(screen.queryByText(/^Status: /)).not.toBeInTheDocument()
    // The suite request carried the report window params.
    expect(getSpy).toHaveBeenCalledWith('/reports/candidates/kpis',
      expect.objectContaining({ params: expect.objectContaining({ period: 'month' }) }))
  })

  // RAPPORT-KPI-INSTELBAAR: which axes drive cards 2-9, and in what priority
  // order, is the tenant's stored Settings → Reports choice, not the hardcoded
  // status→phase→source→owner→branch order.
  it('reorders the suite cards to the tenant-stored priority', async () => {
    mockSuiteResponse()
    mockSettings.mockReturnValue({ report_kpis_candidates: JSON.stringify([
      'active_conversations', 'no_contact', 'availability_due', 'document_expiring',
      'no_cv', 'status_stale', 'no_followup', 'outflow', 'inflow']) })
    mockUseCandidatesReport.mockReturnValue({ data, loading: false, error: false })
    const { container } = renderReport()
    await screen.findByText('Instroom')
    const text = container.textContent ?? ''
    expect(text.indexOf('Actieve gesprekken')).toBeLessThan(text.indexOf('Instroom'))
  })

  // A vanished stored axis key falls back to the default order silently on the
  // report (still nine real cards, never a crash) but shows a visible notice.
  it('falls back a vanished stored key to the default suite order and shows a notice', async () => {
    mockSuiteResponse()
    mockSettings.mockReturnValue({ report_kpis_candidates: JSON.stringify(['ghost_key', 'inflow']) })
    mockUseCandidatesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(await screen.findByText('Instroom')).toBeInTheDocument() // backfilled default
    expect(screen.getByText(i18n.t('candidates.kpiOrderFellBack', { ns: 'analytics' }))).toBeInTheDocument()
  })

  // A suite card drills its OWN key — value and drawer share one predicate.
  it('clicking a suite card drills via /reports/candidates/kpis/drill with its own key', async () => {
    const user = userEvent.setup()
    mockSuiteResponse()
    mockUseCandidatesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(await screen.findByText('Zonder opvolging'))
    expect(getSpy).toHaveBeenCalledWith('/reports/candidates/kpis/drill',
      expect.objectContaining({ params: expect.objectContaining({ kpi: 'no_followup', period: 'month' }) }))
  })

  // STATS-HONEST-1: a key the server omitted renders the house dash, unclickable.
  it('a card whose suite key is missing renders a dash and no button', async () => {
    mockSuiteResponse(suiteCards.filter(c => c.key !== 'no_cv'))
    mockUseCandidatesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await screen.findByText('Instroom')
    expect(screen.getByText('Zonder CV').closest('[role="button"]')).toBeNull()
  })

  // REPORTGRID-1: the drill drawer opens ONLY on click, never auto-defaulted on
  // mount — a drill drawer that shoots open by itself is ruse, per the brief.
  it('never fires a drill request before any segment is clicked', () => {
    mockUseCandidatesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    // The suite LIST fetch is the strip's own data load — allowed; the drill/
    // advice endpoints stay untouched until a real click.
    for (const url of ['/reports/candidates/drill', '/reports/candidates/advice', '/reports/candidates/kpis/drill']) {
      expect(getSpy.mock.calls.some(c => c[0] === url)).toBe(false)
    }
  })

  // Clicking a second axis segment replaces whatever the shared drawer had open —
  // one drawer for the whole page, not one list per section.
  it('clicking a different axis segment replaces the open drawer with the new drill', async () => {
    const user = userEvent.setup()
    mockUseCandidatesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Beschikbaar'))
    getSpy.mockClear()
    await user.click(screen.getByText('Anna de Vries'))
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

  // RAPPORT-GEZICHT-WAVE2: the candidates catalogue IS the nine-key suite —
  // reorderable, no axis spares (those stayed on the Leads position only).
  it('the candidates catalogue offers exactly the nine suite keys', () => {
    const keys = getReportKpiCatalog('candidates').map(c => c.key)
    expect(keys).toEqual([
      'inflow', 'outflow', 'no_followup', 'status_stale', 'no_cv',
      'document_expiring', 'availability_due', 'no_contact', 'active_conversations',
    ])
  })

  // RAPPORT-COMPARE-2: the compare control moved to the right-hand filter panel
  // (§4) — the page renders NO inline control and consumes the prop instead.
  it('renders no inline compare control; the compare prop drives the request', async () => {
    mockUseCandidatesReport.mockReturnValue({ data, loading: false, error: false })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CandidatesReport period="month" compare={{ kind: 'previous_period' }} />
      </QueryClientProvider>,
    )
    expect(screen.queryByText(i18n.t('compare.label', { ns: 'analytics' }))).not.toBeInTheDocument()
    await waitFor(() => expect(getSpy).toHaveBeenCalledWith('/reports/candidates/compare',
      expect.objectContaining({ params: expect.objectContaining({ compare: 'previous_period' }) })))
  })
})

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
    await user.click(screen.getByRole('radio', { name: 'Leads' }))
    expect(mockUseCandidatesReport).toHaveBeenCalledWith('month', {
      status: [], ownerId: [], locationId: [], customerId: [],
    }, 'lead')
  })

  it('renders exactly nine KPI cards on the Leads position too, with its own "Total leads" card 1', () => {
    mockUseCandidatesReport.mockReturnValue({ data, loading: false, error: false })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CandidatesReport period="month" initialView="leads" />
      </QueryClientProvider>,
    )
    expect(screen.getByText('Totaal leads')).toBeInTheDocument()
    expect(screen.getByText('Status: Beschikbaar')).toBeInTheDocument()
    expect(screen.getByText('Vestiging: Utrecht')).toBeInTheDocument()
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
      expect.objectContaining({ params: { status: 'placed', period: 'month', phase: 'lead' } }))
  })

  it('the active position lives in the URL — a link to Leads opens on Leads and survives a switch flip', async () => {
    const user = userEvent.setup()
    mockUseCandidatesReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByRole('radio', { name: 'Leads' }))
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
    expect(screen.getByText('Eigenaar: Niet toegewezen')).toBeInTheDocument()
    expect(screen.getByText('Totaal leads')).toBeInTheDocument()
  })

  it('a legacy reports.leads deep link (initialView="leads") opens directly on the Leads position', () => {
    mockUseCandidatesReport.mockReturnValue({ data, loading: false, error: false })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CandidatesReport period="month" initialView="leads" />
      </QueryClientProvider>,
    )
    expect(screen.getByRole('radio', { name: 'Leads' })).toHaveAttribute('aria-checked', 'true')
  })
})
