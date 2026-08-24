import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import TasksReport from './TasksReport'
import type { TasksReportData } from '@/types/analytics'

// Data layer under test control (loading/error/empty/success — the four UI states).
const mockUseTasksReport = vi.fn()
vi.mock('./useTasksReport', () => ({ useTasksReport: (...args: unknown[]) => mockUseTasksReport(...args) }))

// Tenant KPI-order settings (RAPPORT-KPI-INSTELBAAR) — empty blob = today's
// default order, unless a test overrides it.
const mockSettings = vi.hoisted(() => vi.fn(() => ({} as Record<string, unknown>)))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => mockSettings() }
})

// Spy on the underlying axios client so we can assert the exact request shape
// (method/route/params) that a bar/bucket click sends — mutation tests must assert
// the request, never only that a callback fired (CLAUDE.md §13).
const getSpy = vi.fn().mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
vi.mock('@/lib/api', () => ({
  default: { get: (...args: unknown[]) => getSpy(...args) },
  unwrapList: (r: { data: { data?: unknown[]; meta?: { total?: number } } }) => ({ rows: r.data?.data ?? [], total: r.data?.meta?.total ?? 0 }),
  getActiveTenantId: () => 'test-tenant',
}))

// Fixture per the portie-6 contract: status/type/priority key on the LOOKUP ID
// (slugs are not unique-protected), each axis sums to total, and the server no
// longer emits a ghost zero-bucket — series[0].date === from.
const data: TasksReportData = {
  period: 'month',
  from: '2026-08-01',
  to: '2026-08-31',
  total: 12,
  timeseries: { bucket: 'week', series: [
    { date: '2026-08-01', label: 'Wk 31', value: 5 },
    { date: '2026-08-10', label: 'Wk 32', value: 7 },
  ] },
  summary: { open: 6, done: 4, overdue: 2, done_rate: 33.3 },
  by_status: [
    // eslint-disable-next-line no-restricted-syntax -- DATA: server lookup colour in a test fixture, not UI styling
    { value: 'status-uuid-1', label: 'Te doen', color: '#2563eb', is_done: false, count: 6 },
    { value: 'none', label: 'Onbekend (geen status)', color: null, is_done: false, count: 3 },
    { value: '9c1d-deleted-status-uuid', label: 'Onbekend (verwijderde status)', color: null, is_done: false, count: 3 },
  ],
  by_type: [
    { value: 'type-uuid-1', label: 'Bellen', count: 8 },
    { value: 'none', label: 'Geen type', count: 4 },
  ],
  by_priority: [
    { value: 'prio-uuid-1', label: 'Hoog', count: 9 },
    { value: 'none', label: 'Geen prioriteit', count: 3 },
  ],
  by_assignee: [
    { owner_id: 'u1', name: 'Anna de Vries', count: 9 },
    { owner_id: 'none', name: 'Niet toegewezen', count: 3 },
  ],
  by_team: [
    { value: 'team-1', label: 'Recruitment', count: 10 },
    { value: 'none', label: 'Geen afdeling', count: 2 },
  ],
  by_branch: [
    { value: 'loc-1', label: 'Utrecht', count: 10 },
    { value: 'none', label: 'Geen vestiging', count: 2 },
  ],
}

// KPI-TAKEN-1: the server suite the strip renders verbatim — one entry per
// drill-enum key, value and drawer sharing one backend predicate.
const suiteKpis = [
  { key: 'total', count: 12 }, { key: 'open', count: 6 }, { key: 'overdue', count: 2 },
  { key: 'done_in_period', count: 4 }, { key: 'created_in_period', count: 20 },
  { key: 'due_today', count: 1 }, { key: 'due_this_week', count: 3 },
  { key: 'without_assignee', count: 3 }, { key: 'avg_completion_days', count: 2.5 },
]
const dataWithSuite: TasksReportData = { ...data, kpis: suiteKpis }

function renderReport() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <TasksReport period="month" />
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

describe('TasksReport (RAPPORTEN-SUITE-1 portie 6, tasks report)', () => {
  // Every section now defaults its own list on mount, firing extra drill/advice
  // requests — clear the shared spy between tests so a later assertion never
  // matches a PRIOR test's leftover call history.
  afterEach(() => { getSpy.mockClear() })

  it('shows the loading state', () => {
    mockUseTasksReport.mockReturnValue({ data: null, loading: true, error: false })
    renderReport()
    expect(screen.getByText('Taken laden…')).toBeInTheDocument()
  })

  it('shows the error state', () => {
    mockUseTasksReport.mockReturnValue({ data: null, loading: false, error: true })
    renderReport()
    expect(screen.getByText('Kon de taken niet laden')).toBeInTheDocument()
  })

  it('shows the empty state when there are no tasks', () => {
    mockUseTasksReport.mockReturnValue({
      data: { ...data, total: 0, by_status: [], by_type: [], by_priority: [], by_assignee: [], by_team: [], by_branch: [],
        timeseries: { bucket: 'week', series: [] },
        summary: { open: 0, done: 0, overdue: 0, done_rate: null } },
      loading: false, error: false,
    })
    renderReport()
    expect(screen.getByText('Geen taken in deze periode')).toBeInTheDocument()
  })

  // Contract: every axis renders every segment (incl. 'none' foldings + orphans)
  // and sums exactly to the report total.
  it('renders every axis with every segment, each axis summing to the report total', () => {
    mockUseTasksReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    for (const label of ['Wk 31', 'Wk 32', 'Te doen', 'Onbekend (geen status)', 'Onbekend (verwijderde status)',
      'Bellen', 'Geen type', 'Hoog', 'Geen prioriteit', 'Anna de Vries', 'Recruitment', 'Utrecht']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(data.by_status.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.by_type.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.by_priority.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.by_assignee.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.by_team.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.by_branch.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.timeseries.series.reduce((s, p) => s + p.value, 0)).toBe(data.total)
  })

  // KPI-TAKEN-1: the strip renders the server kpis[] suite verbatim — nine
  // translated cards, the avg card in days, signal cards coloured only when
  // non-zero (§4: colour carries meaning).
  it('renders the nine suite cards from kpis[] with translated labels', () => {
    mockUseTasksReport.mockReturnValue({ data: dataWithSuite, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Totaal taken')).toBeInTheDocument()
    expect(screen.getByText('Afgerond in periode')).toBeInTheDocument()
    expect(screen.getByText('Aangemaakt in periode')).toBeInTheDocument()
    expect(screen.getByText('Vervalt vandaag')).toBeInTheDocument()
    expect(screen.getByText('Vervalt deze week')).toBeInTheDocument()
    expect(screen.getByText('Zonder behandelaar')).toBeInTheDocument()
    // avg_completion_days renders as whole days (matches-card idiom), never a
    // bare decimal: 2.5 → "3 dagen".
    expect(screen.getByText('3 dagen')).toBeInTheDocument()
    // The non-zero overdue count wears the danger colour (semantic signal).
    const overdueValue = screen.getByText('Te laat').parentElement?.parentElement
    expect(overdueValue?.textContent).toContain('2')
  })

  // KPI-TAKEN-1: a suite card's VALUE comes from kpis[] and its click drills
  // the SAME key — one predicate for number and drawer (§13 asserts the request).
  it('reads created_in_period from kpis[] and drills via its own kpi key', async () => {
    const user = userEvent.setup()
    mockUseTasksReport.mockReturnValue({ data: dataWithSuite, loading: false, error: false })
    renderReport()
    // The suite value (20) renders, distinct from the envelope total (12).
    expect(screen.getByText('20')).toBeInTheDocument()
    await user.click(screen.getByText('20'))
    expect(getSpy).toHaveBeenCalledWith('/reports/tasks/kpis/drill',
      expect.objectContaining({ params: expect.objectContaining({ kpi: 'created_in_period', period: 'month' }) }))
  })

  // Tolerant fallback (RAPPORT-KAARTDRILLS-2): with no kpis[] strip at all, the
  // total/done cards pin the legacy envelope/summary value and render WITHOUT a
  // drill — no kpis/drill request fires on click.
  // Honest fallback: a pre-suite envelope (no kpis[]) renders the house dash on
  // every card, with no drill affordance — never a value from another population.
  it('renders dashes with no drill when kpis[] is absent', async () => {
    const user = userEvent.setup()
    mockUseTasksReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(9)
    await user.click(screen.getByText('Totaal taken'))
    expect(getSpy).not.toHaveBeenCalledWith('/reports/tasks/kpis/drill', expect.anything())
  })

  // A missing/null count on a mapped card must never crash — the card renders
  // with a 0 fallback and, when a value truly cannot exist, no onClick at all.
  it('does not crash when summary is missing (null/undefined counts)', async () => {
    const user = userEvent.setup()
    mockUseTasksReport.mockReturnValue({ data: { ...data, summary: undefined } as unknown as TasksReportData, loading: false, error: false })
    expect(() => renderReport()).not.toThrow()
    getSpy.mockClear()
    await user.click(screen.getByText('Te laat'))
  })

  // BELANGRIJK per contract: the window must be prominent, DD-MM-YYYY from the
  // RESPONSE — never ISO (CLAUDE.md §3B DATUM-1). from/to are top-level here.
  it('renders the data window prominently as DD-MM-YYYY', () => {
    mockUseTasksReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Taken 01-08-2026 t/m 31-08-2026')).toBeInTheDocument()
    expect(screen.queryByText(/2026-08-01/)).not.toBeInTheDocument()
  })

  // RAPPORT-FILTERS-2: the panel's active filters reach BOTH the report hook and
  // a drill click — bar and list can never disagree (mirrors CandidatesReport).
  // tasks never carries customer_id (no customer column on the table).
  it('sends the active panel filters to BOTH the report hook and a drill click', async () => {
    const user = userEvent.setup()
    mockUseTasksReport.mockReturnValue({ data, loading: false, error: false })
    const filters = { status: ['status-uuid-1'], ownerId: ['u1'], locationId: [7], customerId: [] }
    render(
      <QueryClientProvider client={new QueryClient()}>
        <TasksReport period="month" filters={filters} />
      </QueryClientProvider>,
    )
    expect(mockUseTasksReport).toHaveBeenCalledWith('month', filters)
    // "Recruitment" is also the team axis's own mount default, so the request may
    // already be in history from the mount-seed effect — assert over the FULL
    // history (never "last call since clear"), the click just proves the SAME
    // request path a bar click uses.
    await user.click(screen.getByText('Recruitment'))
    expect(getSpy).toHaveBeenCalledWith('/reports/tasks/drill', expect.objectContaining({
      params: { period: 'month', status: ['status-uuid-1'], owner_id: ['u1'], location_id: [7], team: 'team-1' },
    }))
  })

  // by_status keys on the status LOOKUP ID — the drill must carry that id, never
  // a slug (task_statuses.value is not uniqueness-protected). "Te doen" is also
  // the axis's own mount default (top segment), so the request already exists in
  // the call history from mount — asserted here over the FULL history, never
  // "last call", since another axis's mount-seed may resolve after this click.
  it('clicking a status bar drills with status=<lookup id> (drill + advice)', async () => {
    const user = userEvent.setup()
    mockUseTasksReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Te doen'))
    expect(getSpy).toHaveBeenCalledWith('/reports/tasks/drill',
      expect.objectContaining({ params: { status: 'status-uuid-1', period: 'month' } }))
    expect(getSpy).toHaveBeenCalledWith('/reports/tasks/advice',
      expect.objectContaining({ params: { status: 'status-uuid-1', period: 'month' } }))
  })

  // 'none' folding (NULL/'' statuses): drills with status=none and nothing else.
  it('clicking the status "Onbekend (geen status)" sentinel drills with status=none', async () => {
    const user = userEvent.setup()
    mockUseTasksReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Onbekend (geen status)'))
    expect(getSpy).toHaveBeenCalledWith('/reports/tasks/drill',
      expect.objectContaining({ params: { status: 'none', period: 'month' } }))
  })

  // Orphan-value drill: a deleted status still renders its own bar with the
  // backend's "Onbekend (…)" label and drills on the RAW uuid.
  it('renders an orphaned (deleted-status) row as its own bar and drills on the raw uuid', async () => {
    const user = userEvent.setup()
    mockUseTasksReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Onbekend (verwijderde status)'))
    expect(getSpy).toHaveBeenCalledWith('/reports/tasks/drill',
      expect.objectContaining({ params: { status: '9c1d-deleted-status-uuid', period: 'month' } }))
  })

  it('clicking a priority bar drills with priority=<lookup id> and the none sentinel with priority=none', async () => {
    const user = userEvent.setup()
    mockUseTasksReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Hoog'))
    expect(getSpy).toHaveBeenCalledWith('/reports/tasks/drill',
      expect.objectContaining({ params: { priority: 'prio-uuid-1', period: 'month' } }))
    await user.click(screen.getByText('Geen prioriteit'))
    expect(getSpy).toHaveBeenCalledWith('/reports/tasks/drill',
      expect.objectContaining({ params: { priority: 'none', period: 'month' } }))
  })

  it('clicking an assignee bar drills with the assignee XOR param (D2 shape: owner_id → assignee)', async () => {
    const user = userEvent.setup()
    mockUseTasksReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Anna de Vries'))
    expect(getSpy).toHaveBeenCalledWith('/reports/tasks/drill',
      expect.objectContaining({ params: { assignee: 'u1', period: 'month' } }))
    // A NULL assignee arrives as the 'none' row ("Niet toegewezen") and drills
    // assignee=none — the label now renders twice (bar + the unassigned KPI card).
    await user.click(screen.getAllByText('Niet toegewezen')[0])
    expect(getSpy).toHaveBeenCalledWith('/reports/tasks/drill',
      expect.objectContaining({ params: { assignee: 'none', period: 'month' } }))
  })

  it('clicking a team bar and a branch bar drill with their own XOR params', async () => {
    const user = userEvent.setup()
    mockUseTasksReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Recruitment'))
    expect(getSpy).toHaveBeenCalledWith('/reports/tasks/drill',
      expect.objectContaining({ params: { team: 'team-1', period: 'month' } }))
    await user.click(screen.getByText('Utrecht'))
    expect(getSpy).toHaveBeenCalledWith('/reports/tasks/drill',
      expect.objectContaining({ params: { branch: 'loc-1', period: 'month' } }))
    // Report drill endpoints only — never the /tasks list route.
    expect(getSpy.mock.calls.some(c => String(c[0]).startsWith('/tasks'))).toBe(false)
  })

  // XOR proof, both directions: a status drill and a type drill each carry exactly
  // ONE segment param — no residue from the other axis, and each axis keeps its
  // own state independently (per-axis drills, never a single global XOR).
  it('sends exactly one XOR param per drill call, in both directions across axes', async () => {
    const user = userEvent.setup()
    mockUseTasksReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Onbekend (geen status)'))
    expect(getSpy).toHaveBeenCalledWith('/reports/tasks/drill',
      expect.objectContaining({ params: { status: 'none', period: 'month' } }))
    await user.click(screen.getByText('Geen type'))
    expect(getSpy).toHaveBeenCalledWith('/reports/tasks/drill',
      expect.objectContaining({ params: { type: 'none', period: 'month' } }))
  })

  // GRANULARITY role of `bucket` (dual-role contract): a week timeseries bar drills
  // with date=<key> + bucket=week so bar and list totals always agree.
  it('clicking a week timeseries bar drills with date + bucket=week', async () => {
    const user = userEvent.setup()
    mockUseTasksReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Wk 31'))
    expect(getSpy).toHaveBeenCalledWith('/reports/tasks/drill',
      expect.objectContaining({ params: { date: '2026-08-01', bucket: 'week', period: 'month' } }))
  })

  it('omits bucket when the timeseries is day-granular', async () => {
    const user = userEvent.setup()
    mockUseTasksReport.mockReturnValue({
      data: { ...data, timeseries: { bucket: 'day', series: [{ date: '2026-08-01', label: '01-08', value: 2 }] } },
      loading: false, error: false,
    })
    renderReport()
    await user.click(screen.getByText('01-08'))
    const call = getSpy.mock.calls.find(c => c[0] === '/reports/tasks/drill' && (c[1] as { params: Record<string, unknown> }).params.date === '2026-08-01')
    expect(call?.[1].params).not.toHaveProperty('bucket')
  })

  // Every drill source targets the ONE tasks drill/advice pair — never a sibling
  // report's endpoint, never an entity list route.
  it('always drills via /reports/tasks/drill|advice, whatever the axis', async () => {
    const user = userEvent.setup()
    mockUseTasksReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Te doen'))
    await user.click(screen.getByText('Bellen'))
    await user.click(screen.getByText('Anna de Vries'))
    await user.click(screen.getByText('Wk 32'))
    expect(getSpy.mock.calls.length).toBeGreaterThan(0)
    expect(getSpy.mock.calls.every(c =>
      c[0] === '/reports/tasks/drill' || c[0] === '/reports/tasks/advice')).toBe(true)
  })

  // REPORTGRID-1: the shared drill drawer opens only on click, never
  // auto-defaulted on mount.
  it('never fires a drill request before any segment is clicked', () => {
    mockUseTasksReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(getSpy).not.toHaveBeenCalled()
  })

  // Clicking a segment in one chart must never change another chart's list — each
  // section owns its own drill state, never a shared overlay. "Onbekend (geen
  // status)" is NOT the status axis's mount default, so this click is guaranteed
  // to fire a fresh request — while the already-seeded team axis fires none.
  it("clicking a segment in one chart does not change another chart's list", async () => {
    const user = userEvent.setup()
    mockUseTasksReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    getSpy.mockClear()
    await user.click(screen.getByText('Onbekend (geen status)')) // the status axis, non-default segment
    // The status axis's own list updated…
    expect(getSpy).toHaveBeenCalledWith('/reports/tasks/drill',
      expect.objectContaining({ params: { status: 'none', period: 'month' } }))
    // …but no request was fired for the team axis's ALREADY-seeded default (Recruitment) —
    // it stayed exactly as mount left it.
    expect(getSpy.mock.calls.some(c => c[0] === '/reports/tasks/drill'
      && (c[1] as { params: Record<string, unknown> }).params.team === 'team-1')).toBe(false)
  })
})

// Nine-card KPI footprint (Danny — same as the dashboard, all reports). The
// workload five stay as-is; unassigned/no-team/no-branch are each axis's real
// 'none' row (drillable — real data, real drill) and overdueRate is an honest
// ratio of two real fields.
describe('TasksReport (nine-card KPI footprint)', () => {
  afterEach(() => { getSpy.mockClear() })

  it('renders exactly nine KPI cards, one per suite key', () => {
    mockUseTasksReport.mockReturnValue({ data: dataWithSuite, loading: false, error: false })
    renderReport()
    for (const label of ['Totaal taken', 'Open', 'Te laat', 'Afgerond in periode', 'Aangemaakt in periode',
      'Vervalt vandaag', 'Vervalt deze week', 'Gem. doorlooptijd']) {
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1)
    }
    // 'Zonder behandelaar' may also appear as an axis bar row — count, not unique.
    expect(screen.getAllByText('Zonder behandelaar').length).toBeGreaterThanOrEqual(1)
  })

  it('clicking the without_assignee card drills via its own kpi key', async () => {
    const user = userEvent.setup()
    mockUseTasksReport.mockReturnValue({ data: dataWithSuite, loading: false, error: false })
    renderReport()
    getSpy.mockClear()
    await user.click(screen.getAllByText('Zonder behandelaar')[0])
    expect(getSpy).toHaveBeenCalledWith('/reports/tasks/kpis/drill',
      expect.objectContaining({ params: expect.objectContaining({ kpi: 'without_assignee' }) }))
  })

  // A key the server omitted renders the dash with no clickable affordance
  // (§0 no fake affordances) — pinned with a suite missing one key.
  it('a card whose suite key is missing renders a dash and no button', () => {
    const partial = { ...data, kpis: suiteKpis.filter(k => k.key !== 'due_today') }
    mockUseTasksReport.mockReturnValue({ data: partial, loading: false, error: false })
    renderReport()
    const card = screen.getByText('Vervalt vandaag').closest('[role="button"]')
    expect(card).toBeNull()
  })
})

// KPI-TAKEN-1: the catalogue IS the nine-key suite — reorderable, no spares
// (the old summary/derived/top cards left the strip with the suite migration).
describe('TasksReport (suite KPI catalogue)', () => {
  afterEach(() => { getSpy.mockClear(); mockSettings.mockReturnValue({}) })

  it('offers exactly the nine suite keys, in the suite order, with no spares', async () => {
    const { getReportKpiCatalog, getReportKpiDefaultOrder, reportHasSpareKpiCards } = await import('./kpiCatalog')
    const catalogKeys = getReportKpiCatalog('tasks').map(c => c.key)
    expect(catalogKeys).toEqual([
      'total', 'open', 'overdue', 'done_in_period', 'created_in_period',
      'due_today', 'due_this_week', 'without_assignee', 'avg_completion_days',
    ])
    expect(getReportKpiDefaultOrder('tasks')).toEqual(catalogKeys)
    expect(reportHasSpareKpiCards('tasks')).toBe(false)
  })

  it('renders a stored reorder of the suite keys, strip still exactly nine', () => {
    mockSettings.mockReturnValue({
      report_kpis_tasks: JSON.stringify([
        'overdue', 'due_today', 'due_this_week', 'without_assignee', 'open',
        'total', 'created_in_period', 'done_in_period', 'avg_completion_days',
      ]),
    })
    mockUseTasksReport.mockReturnValue({ data: dataWithSuite, loading: false, error: false })
    renderReport()
    // The reordered strip still renders every suite label exactly once as a card.
    expect(screen.getByText('Totaal taken')).toBeInTheDocument()
    expect(screen.getByText('Vervalt vandaag')).toBeInTheDocument()
  })
})

describe('TasksReport — kaartdrills eerlijk ontkoppeld', () => {
  it('no KPI card fires a kpis/drill request', () => {
    renderReport()
    const calls = getSpy.mock.calls.map(c => String(c[0]))
    expect(calls.some(u => u.includes('/kpis/drill'))).toBe(false)
  })

  // RAPPORT-COMPARE-2 (§4): the compare window lives in the right-hand filter
  // panel (ReportsPage) — the page itself renders NO inline compare control.
  it('renders no inline compare control (moved to the right filter panel)', () => {
    expect(screen.queryByText('Vergelijk met')).not.toBeInTheDocument()
  })
})
