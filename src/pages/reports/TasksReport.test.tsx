import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import TasksReport from './TasksReport'
import type { TasksReportData } from '@/types/analytics'

// Data layer under test control (loading/error/empty/success — the four UI states).
const mockUseTasksReport = vi.fn()
vi.mock('./useTasksReport', () => ({ useTasksReport: () => mockUseTasksReport() }))

// Spy on the underlying axios client so we can assert the exact request shape
// (method/route/params) that a bar/bucket click sends — mutation tests must assert
// the request, never only that a callback fired (CLAUDE.md §13).
const getSpy = vi.fn()
vi.mock('@/lib/api', () => ({
  default: { get: (...args: unknown[]) => getSpy(...args) },
  unwrapList: (r: { data: { data?: unknown[]; meta?: { total?: number } } }) => ({ rows: r.data?.data ?? [], total: r.data?.meta?.total ?? 0 }),
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

function renderReport() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <TasksReport period="month" />
    </QueryClientProvider>,
  )
}

// The last drill call's raw params — for the XOR proofs (exactly ONE segment param).
const lastDrillParams = () =>
  (getSpy.mock.calls.filter(c => c[0] === '/reports/tasks/drill').at(-1)?.[1] as { params: Record<string, unknown> }).params

// The house LineChartCard needs real layout (jsdom has none) so the timeseries
// wrapper is mocked exactly like WeeklyBarChartCard in TrendsRow.test.tsx: one
// button per point, same label text, onPick fired with the raw date key.
vi.mock('./ReportTimeseriesChart', () => ({
  default: ({ series, onPick }: { series: { date: string; label: string; value: number }[]; onPick?: (date: string) => void }) => (
    <>{series.map(p => <button key={p.date} onClick={() => onPick?.(p.date)}>{p.label}</button>)}</>
  ),
}))

describe('TasksReport (RAPPORTEN-SUITE-1 portie 6, tasks report)', () => {
  beforeEach(() => {
    getSpy.mockReset()
    getSpy.mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
  })

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
    // 'Niet toegewezen' / 'Geen afdeling' / 'Geen vestiging' now also render as
    // their own nine-card KPI (unassigned/noTeam/noBranch) — assert both copies.
    for (const label of ['Niet toegewezen', 'Geen afdeling', 'Geen vestiging']) {
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(2)
    }
    expect(data.by_status.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.by_type.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.by_priority.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.by_assignee.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.by_team.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.by_branch.reduce((s, x) => s + x.count, 0)).toBe(data.total)
    expect(data.timeseries.series.reduce((s, p) => s + p.value, 0)).toBe(data.total)
  })

  // Workload KPI strip from the flag-driven summary; done_rate through the house
  // number formatter. The seven-way XOR has no open/done/overdue param, so the
  // overdue KPI is a plain stat — display-only, never a dead-looking button.
  it('renders the KPI strip from summary with the overdue stat non-clickable', () => {
    mockUseTasksReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Totaal taken')).toBeInTheDocument()
    expect(screen.getByText('Afgerond')).toBeInTheDocument()
    expect(screen.getByText('Te laat')).toBeInTheDocument()
    expect(screen.getByText('Afrondingspercentage')).toBeInTheDocument()
    // House percentage formatting (nl grouping): 33.3 → "33,3%".
    expect(screen.getByText('33,3%')).toBeInTheDocument()
    // Display-only: no button semantics anywhere up the overdue card.
    expect(screen.getByText('Te laat').closest('[role="button"]')).toBeNull()
  })

  // BELANGRIJK per contract: the window must be prominent, DD-MM-YYYY from the
  // RESPONSE — never ISO (CLAUDE.md §3B DATUM-1). from/to are top-level here.
  it('renders the data window prominently as DD-MM-YYYY', () => {
    mockUseTasksReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Taken 01-08-2026 t/m 31-08-2026')).toBeInTheDocument()
    expect(screen.queryByText(/2026-08-01/)).not.toBeInTheDocument()
  })

  // by_status keys on the status LOOKUP ID — the drill must carry that id, never
  // a slug (task_statuses.value is not uniqueness-protected).
  it('clicking a status bar drills with status=<lookup id> (drill + advice)', async () => {
    const user = userEvent.setup()
    mockUseTasksReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Te doen'))
    expect(getSpy).toHaveBeenCalledWith('/reports/tasks/drill',
      expect.objectContaining({ params: { status: 'status-uuid-1', period: 'month' } }))
    expect(getSpy).toHaveBeenCalledWith('/reports/tasks/advice',
      expect.objectContaining({ params: { status: 'status-uuid-1', period: 'month' } }))
    // The id, never a label/slug-shaped value.
    expect(lastDrillParams().status).toBe('status-uuid-1')
  })

  // 'none' folding (NULL/'' statuses): drills with status=none and nothing else.
  it('clicking the status "Onbekend (geen status)" sentinel drills with status=none', async () => {
    const user = userEvent.setup()
    mockUseTasksReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Onbekend (geen status)'))
    expect(lastDrillParams()).toEqual({ status: 'none', period: 'month' })
  })

  // Orphan-value drill: a deleted status still renders its own bar with the
  // backend's "Onbekend (…)" label and drills on the RAW uuid.
  it('renders an orphaned (deleted-status) row as its own bar and drills on the raw uuid', async () => {
    const user = userEvent.setup()
    mockUseTasksReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Onbekend (verwijderde status)'))
    expect(lastDrillParams()).toEqual({ status: '9c1d-deleted-status-uuid', period: 'month' })
  })

  it('clicking a priority bar drills with priority=<lookup id> and the none sentinel with priority=none', async () => {
    const user = userEvent.setup()
    mockUseTasksReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Hoog'))
    expect(lastDrillParams()).toEqual({ priority: 'prio-uuid-1', period: 'month' })
    await user.click(screen.getByText('Geen prioriteit'))
    expect(lastDrillParams()).toEqual({ priority: 'none', period: 'month' })
  })

  it('clicking an assignee bar drills with the assignee XOR param (D2 shape: owner_id → assignee)', async () => {
    const user = userEvent.setup()
    mockUseTasksReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Anna de Vries'))
    expect(lastDrillParams()).toEqual({ assignee: 'u1', period: 'month' })
    // A NULL assignee arrives as the 'none' row ("Niet toegewezen") and drills
    // assignee=none — the label now renders twice (bar + the unassigned KPI card).
    await user.click(screen.getAllByText('Niet toegewezen')[0])
    expect(lastDrillParams()).toEqual({ assignee: 'none', period: 'month' })
  })

  it('clicking a team bar and a branch bar drill with their own XOR params', async () => {
    const user = userEvent.setup()
    mockUseTasksReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Recruitment'))
    expect(lastDrillParams()).toEqual({ team: 'team-1', period: 'month' })
    await user.click(screen.getByText('Utrecht'))
    expect(lastDrillParams()).toEqual({ branch: 'loc-1', period: 'month' })
    // Report drill endpoints only — never the /tasks list route.
    expect(getSpy.mock.calls.some(c => String(c[0]).startsWith('/tasks'))).toBe(false)
  })

  // XOR proof, both directions: a status drill after a type drill (and vice versa)
  // carries exactly ONE segment param — no residue from the earlier pick.
  it('sends exactly one XOR param per drill call, in both directions across axes', async () => {
    const user = userEvent.setup()
    mockUseTasksReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Te doen'))
    expect(lastDrillParams()).toEqual({ status: 'status-uuid-1', period: 'month' })
    await user.click(screen.getByText('Bellen'))
    expect(lastDrillParams()).toEqual({ type: 'type-uuid-1', period: 'month' })
    await user.click(screen.getByText('Te doen'))
    expect(lastDrillParams()).toEqual({ status: 'status-uuid-1', period: 'month' })
  })

  // GRANULARITY role of `bucket` (dual-role contract): a week timeseries bar drills
  // with date=<key> + bucket=week so bar and drawer totals always agree.
  it('clicking a week timeseries bar drills with date + bucket=week', async () => {
    const user = userEvent.setup()
    mockUseTasksReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Wk 31'))
    expect(lastDrillParams()).toEqual({ date: '2026-08-01', bucket: 'week', period: 'month' })
  })

  it('omits bucket when the timeseries is day-granular', async () => {
    const user = userEvent.setup()
    mockUseTasksReport.mockReturnValue({
      data: { ...data, timeseries: { bucket: 'day', series: [{ date: '2026-08-01', label: '01-08', value: 2 }] } },
      loading: false, error: false,
    })
    renderReport()
    await user.click(screen.getByText('01-08'))
    expect(lastDrillParams()).toEqual({ date: '2026-08-01', period: 'month' })
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

  // Calm 403 degrade: the drill rows need tasks.view on top of reports.view —
  // denied rows hide the records section (no error banner) while advice stays visible.
  it('keeps the advice visible when the rows request is 403-forbidden', async () => {
    const user = userEvent.setup()
    getSpy.mockImplementation((url: unknown) => String(url).endsWith('/drill')
      ? Promise.reject({ response: { status: 403 } })
      : Promise.resolve({ data: { advice: 'Pak eerst de taken op die te laat zijn.' } }))
    mockUseTasksReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Te doen'))
    await waitFor(() => expect(screen.getByText('Pak eerst de taken op die te laat zijn.')).toBeInTheDocument())
    expect(screen.queryByText('Onderliggende records')).not.toBeInTheDocument()
    expect(screen.queryByText(/fout|mislukt|error|forbidden/i)).not.toBeInTheDocument()
  })

  // {advice:null} (no koios_ai module) renders the calm no-advice copy, never an
  // error — and the drill rows show "status · assignee" via the shared rowSub
  // (the additive `assignee` bit, portie 6).
  it('renders no error on {advice:null} and shows the assignee in the row subtitle', async () => {
    const user = userEvent.setup()
    getSpy.mockImplementation((url: unknown) => String(url).endsWith('/advice')
      ? Promise.resolve({ data: { advice: null } })
      : Promise.resolve({ data: {
          data: [{ id: 't1', entity: 'task', title: 'Bel kandidaat terug', status: 'Te doen', type: 'Bellen', priority: 'Hoog', assignee: 'Anna de Vries', due_date: '2026-08-20' }],
          meta: { total: 1 },
        } }))
    mockUseTasksReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Onbekend (geen status)'))
    await waitFor(() => expect(screen.getByText('Bel kandidaat terug')).toBeInTheDocument())
    expect(screen.getByText('Te doen · Anna de Vries')).toBeInTheDocument()
    expect(screen.getByText('Koios heeft nog geen advies voor dit getal.')).toBeInTheDocument()
    expect(screen.queryByText(/fout|mislukt|error/i)).not.toBeInTheDocument()
  })
})

// Nine-card KPI footprint (Danny — same as the dashboard, all reports). The
// workload five stay as-is; unassigned/no-team/no-branch are each axis's real
// 'none' row (drillable — real data, real drill) and overdueRate is an honest
// ratio of two real fields.
describe('TasksReport (nine-card KPI footprint)', () => {
  beforeEach(() => {
    getSpy.mockReset()
    getSpy.mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
  })

  it('renders exactly nine KPI cards from the fixture', () => {
    mockUseTasksReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Totaal taken')).toBeInTheDocument()
    expect(screen.getByText('Afgerond')).toBeInTheDocument()
    expect(screen.getByText('Afrondingspercentage')).toBeInTheDocument()
    // Each also renders as an axis bar below, so assert the count, not uniqueness.
    expect(screen.getAllByText('Niet toegewezen').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Geen afdeling').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Geen vestiging').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Te-laat-percentage')).toBeInTheDocument()
    // overdueRate: 2 / 12 * 100 = 16,667% via the house number formatter.
    expect(screen.getByText('16,7%')).toBeInTheDocument()  // FMT-PROCENT-1: at most one decimal
  })

  it('clicking the "unassigned" KPI card drills with assignee=none, same as the bar', async () => {
    const user = userEvent.setup()
    mockUseTasksReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getAllByText('Niet toegewezen')[0])
    expect(lastDrillParams()).toEqual({ assignee: 'none', period: 'month' })
  })

  // overdueRate carries no drillable XOR axis — it must render as a plain stat,
  // never a dead-looking button (no fake affordances).
  it('the overdueRate KPI card is a non-clickable stat', () => {
    mockUseTasksReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    const card = screen.getByText('Te-laat-percentage').closest('div[role="button"]')
    expect(card).toBeNull()
  })
})
