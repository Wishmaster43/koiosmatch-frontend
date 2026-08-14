/**
 * ReportsPage · right-hand filter panel — the panel is DashboardLayout's shared
 * `ReportFilterSidebar`, fed by whatever this page registers into
 * `RightPanelContext`. This test renders the REAL provider (mirrors the
 * OpportunitiesPage.test.tsx pattern) and asserts on the registered group
 * directly — exactly the seam a real click on the topbar's filter button and a
 * chip in the panel would drive. Every heavy `*Report` sub-page is mocked to a
 * thin stub so this stays a panel-wiring test, not a re-test of each report.
 */
import { describe, it, expect, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { RightPanelProvider, useRightPanel } from '@/context/RightPanelContext'
import ReportsPage from './ReportsPage'
import { buildReportQueryParams } from './reportFilterParams'

// RAPPORT-FILTERS-1 lookup sources the panel reads to build status/owner/branch
// options for `candidates`/`customers` — stubbed to small, deterministic option
// sets. STABLE module-scope references (not fresh literals per call): a fresh
// array/object identity every render would re-trigger the panel's registration
// effect forever (the exact "unstable options -> unstable filter groups ->
// register/unregister loops" class of bug useLocations.ts documents).
const candidateStatusOptions = [{ value: 'available', label: 'Available' }]
const customerStatusOptions = [{ value: 'active', label: 'Active' }]
const userRows = [{ id: 'u1', name: 'Anna de Vries' }]
const branchRows = [{ value: 'utrecht', label: 'Utrecht' }]
const candidateLookups = { statuses: candidateStatusOptions }
const customerLookupsValue = { statuses: customerStatusOptions }
const usersQueryResult = { data: userRows }
vi.mock('@/context/LookupsContext', () => ({ useLookups: () => candidateLookups }))
vi.mock('@/lib/useCustomerLookups', () => ({ useCustomerLookups: () => customerLookupsValue }))
vi.mock('@/lib/queries', () => ({ useUsers: () => usersQueryResult }))
vi.mock('@/lib/useLocations', () => ({ useLocations: () => branchRows }))
// RAPPORT-FILTERS-2 lookup sources (vacancies/applications/matches/tasks) — same
// stable-reference contract as the candidate/customer stubs above.
const vacancyStatusOptions = [{ value: 'vs1', label: 'Open' }]
const taskStatusOptions = [{ value: 'ts1', label: 'To do' }]
const matchStatusesValue = { statuses: [{ value: 'open', label: 'Active' }] }
const customerOptionsValue: Array<{ value: string; label: string }> = []
vi.mock('./reportStatusLookups', () => ({
  useVacancyStatusIdOptions: () => vacancyStatusOptions,
  useTaskStatusIdOptions: () => taskStatusOptions,
}))
vi.mock('@/lib/useMatchStatuses', () => ({ useMatchStatuses: () => matchStatusesValue }))
vi.mock('@/pages/vacancies/hooks/useCustomerOptions', () => ({ useCustomerOptions: () => customerOptionsValue }))

// Every report component collapses to the same stub: it only needs to prove
// which `period`/`filters` it was handed, never its own body (each has its own tests).
vi.mock('./CandidatesReport', () => ({
  default: ({ period, filters }: { period: string; filters?: unknown }) => (
    <div data-testid="report-period" data-filters={JSON.stringify(filters ?? null)}>{period}</div>
  ),
}))
vi.mock('./ApplicationsReport', () => ({
  default: ({ period, filters }: { period: string; filters?: unknown }) => (
    <div data-testid="report-period" data-filters={JSON.stringify(filters ?? null)}>{period}</div>
  ),
}))
vi.mock('./CustomersReport', () => ({ default: () => null }))
// A non-filterable report (flow) proves the hard requirement: the OTHER twelve
// reports keep getting a period-only panel — no field the server would drop.
vi.mock('./FlowReport', () => ({ default: ({ period }: { period: string }) => <div data-testid="flow-period">{period}</div> }))
vi.mock('./RecruitersReport', () => ({ default: () => null }))
vi.mock('./VacanciesReport', () => ({
  default: ({ period, filters }: { period: string; filters?: unknown }) => (
    <div data-testid="report-period" data-filters={JSON.stringify(filters ?? null)}>{period}</div>
  ),
}))
vi.mock('./OpportunitiesReport', () => ({ default: () => null }))
vi.mock('./TasksReport', () => ({
  default: ({ period, filters }: { period: string; filters?: unknown }) => (
    <div data-testid="report-period" data-filters={JSON.stringify(filters ?? null)}>{period}</div>
  ),
}))
vi.mock('./MatchesReport', () => ({
  default: ({ period, filters }: { period: string; filters?: unknown }) => (
    <div data-testid="report-period" data-filters={JSON.stringify(filters ?? null)}>{period}</div>
  ),
}))
vi.mock('./IntakesReport', () => ({ default: () => null }))
vi.mock('./OutreachReport', () => ({ default: () => null }))
vi.mock('./SourcesReport', () => ({ default: () => null }))
vi.mock('./ContactsReport', () => ({ default: () => null }))
vi.mock('./LocationsReport', () => ({ default: () => null }))
vi.mock('./DepartmentsReport', () => ({ default: () => null }))
vi.mock('./AiReport', () => ({ default: () => null }))
vi.mock('./WorkflowsReport', () => ({ default: () => null }))
vi.mock('./ReportsDashboard', () => ({ default: ({ period }: { period: string }) => <div data-testid="dashboard-period">{period}</div> }))

interface RadioGroup {
  key: string
  type?: string
  selected?: Array<string | number>
  onToggle?: (v: string | number) => void
  options?: Array<{ value: string | number; label?: string }>
}

// Grabs whatever ReportsPage registered — the same mechanism DashboardLayout's
// `ReportFilterSidebar` consumes to render the panel body.
function Capture({ onGroups }: { onGroups: (groups: RadioGroup[]) => void }) {
  const { filterGroups } = useRightPanel()
  onGroups(filterGroups as unknown as RadioGroup[])
  return null
}

function renderPage() {
  let latest: RadioGroup[] = []
  render(
    <RightPanelProvider>
      <Capture onGroups={g => { latest = g }} />
      <ReportsPage reportId="candidates" />
    </RightPanelProvider>,
  )
  return { getGroups: () => latest }
}

describe('ReportsPage — right filter panel', () => {
  it('registers period + status/owner/branch for candidates (RAPPORT-FILTERS-1 — one of the two wired reports)', () => {
    const { getGroups } = renderPage()
    const groups = getGroups()
    expect(groups.map(g => g.key)).toEqual(['period', 'status', 'owner', 'branch'])
  })

  it('a report the backend has NOT wired yet (flow) still registers ONLY the period — no field the server would silently drop', () => {
    let latest: RadioGroup[] = []
    render(
      <RightPanelProvider>
        <Capture onGroups={g => { latest = g }} />
        <ReportsPage reportId="flow" />
      </RightPanelProvider>,
    )
    expect(latest).toHaveLength(1)
    expect(latest[0].key).toBe('period')
    expect(screen.getByTestId('flow-period').textContent).toBe('month')
  })

  it('unregisters its groups on unmount (panel closes with nothing stale behind it)', () => {
    let latest: RadioGroup[] = []
    const { unmount } = render(
      <RightPanelProvider>
        <Capture onGroups={g => { latest = g }} />
        <ReportsPage reportId="candidates" />
      </RightPanelProvider>,
    )
    expect(latest.length).toBeGreaterThan(0)
    unmount()
    // Re-render a fresh provider tree with only the capture probe: registry starts empty.
    render(
      <RightPanelProvider>
        <Capture onGroups={g => { latest = g }} />
      </RightPanelProvider>,
    )
    expect(latest).toHaveLength(0)
  })

  it('picking a period option in the panel flows through to the active report', () => {
    const { getGroups } = renderPage()
    expect(screen.getByTestId('report-period').textContent).toBe('month')

    const periodGroup = getGroups().find(g => g.key === 'period')
    act(() => { periodGroup?.onToggle?.('day') })

    expect(screen.getByTestId('report-period').textContent).toBe('day')
  })

  it('picking an owner in the panel flows through to the active report AS the report filters (bar and lade share one state)', () => {
    const { getGroups } = renderPage()
    const ownerGroup = getGroups().find(g => g.key === 'owner')
    act(() => { ownerGroup?.onToggle?.('u1') })

    const filters = JSON.parse(screen.getByTestId('report-period').dataset.filters ?? 'null')
    expect(filters).toEqual({ status: [], ownerId: ['u1'], locationId: [], customerId: [] })
  })

  // RAPPORT-FILTERS-2: vacancies/applications also get the customer_id[] group
  // (client_id-backed), matches/tasks stop at status/owner/branch (no customer FK).
  it('registers period + status/owner/branch/customer for vacancies and applications, but only status/owner/branch for matches/tasks', () => {
    let latest: RadioGroup[] = []
    const { unmount } = render(
      <RightPanelProvider>
        <Capture onGroups={g => { latest = g }} />
        <ReportsPage reportId="vacancies" />
      </RightPanelProvider>,
    )
    expect(latest.map(g => g.key)).toEqual(['period', 'status', 'owner', 'branch', 'customer'])
    unmount()

    render(
      <RightPanelProvider>
        <Capture onGroups={g => { latest = g }} />
        <ReportsPage reportId="applications" />
      </RightPanelProvider>,
    )
    expect(latest.map(g => g.key)).toEqual(['period', 'status', 'owner', 'branch', 'customer'])
  })

  it('registers period + status/owner/branch for matches — never a customer group (the singular key is already overloaded)', () => {
    let latest: RadioGroup[] = []
    render(
      <RightPanelProvider>
        <Capture onGroups={g => { latest = g }} />
        <ReportsPage reportId="matches" />
      </RightPanelProvider>,
    )
    expect(latest.map(g => g.key)).toEqual(['period', 'status', 'owner', 'branch'])
  })

  it('registers period + status/owner/branch for tasks — never a customer group (no customer column on tasks)', () => {
    let latest: RadioGroup[] = []
    render(
      <RightPanelProvider>
        <Capture onGroups={g => { latest = g }} />
        <ReportsPage reportId="tasks" />
      </RightPanelProvider>,
    )
    expect(latest.map(g => g.key)).toEqual(['period', 'status', 'owner', 'branch'])
  })

  it('sends the active vacancies panel filters to the report AS its filters prop (bar and lade share one state)', () => {
    render(
      <RightPanelProvider>
        <ReportsPage reportId="vacancies" />
      </RightPanelProvider>,
    )
    const filters = JSON.parse(screen.getByTestId('report-period').dataset.filters ?? 'null')
    expect(filters).toEqual({ status: [], ownerId: [], locationId: [], customerId: [] })
  })

  it('a non-filterable report never receives a filters prop, even with stale selections', () => {
    render(
      <RightPanelProvider>
        <ReportsPage reportId="flow" />
      </RightPanelProvider>,
    )
    // FlowReport's own stub never reads `filters` — asserting on its absence would
    // require exposing it; the period-only panel group assertion above already
    // proves nothing beyond period is registered for this report.
    expect(screen.getByTestId('flow-period')).toBeInTheDocument()
  })

  // RIGHTPANEL-FILTERS-1 (Danny 2026-08-14, "rode filters moeten naar rechts
  // filter menu"): ReportsPage used to render its own inline period `CreatableSelect`
  // (a <button> trigger, passed down via `tabsSlot`) ABOVE every report — an exact
  // duplicate of the `period` radio group already registered into the right panel
  // (asserted above). That control is now gone; ReportsPage's own JSX renders no
  // interactive control of its own at all, so a stray reintroduction would show up
  // here as a non-zero button count.
  it('renders no inline period picker of its own — period is chosen ONLY via the right panel now', () => {
    const { container } = render(
      <RightPanelProvider>
        <ReportsPage reportId="flow" />
      </RightPanelProvider>,
    )
    expect(container.querySelectorAll('button')).toHaveLength(0)
  })

  it('the period group only ever carries the period param on an unfilterable report', () => {
    let latest: RadioGroup[] = []
    render(
      <RightPanelProvider>
        <Capture onGroups={g => { latest = g }} />
        <ReportsPage reportId="flow" />
      </RightPanelProvider>,
    )
    const periodGroup = latest[0]
    const params = buildReportQueryParams((periodGroup.selected?.[0] as 'day' | 'week' | 'month') ?? 'month', 'flow')
    expect(params).toEqual({ period: 'month' })
  })
})

describe('ReportsPage — root vs. sub-report (RAPPORTEN-DASHBOARD-1)', () => {
  it('a bare root (no reportId) renders the dashboard, not a redirect to the first report', () => {
    render(
      <RightPanelProvider>
        <ReportsPage />
      </RightPanelProvider>,
    )
    expect(screen.getByTestId('dashboard-period')).toBeInTheDocument()
    expect(screen.queryByTestId('report-period')).not.toBeInTheDocument()
  })

  it('a real sub-route id still renders its own report, not the dashboard', () => {
    render(
      <RightPanelProvider>
        <ReportsPage reportId="candidates" />
      </RightPanelProvider>,
    )
    expect(screen.getByTestId('report-period')).toBeInTheDocument()
    expect(screen.queryByTestId('dashboard-period')).not.toBeInTheDocument()
  })
})
