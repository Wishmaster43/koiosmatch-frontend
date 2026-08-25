/**
 * ReportsPage · right-hand filter panel — the panel is DashboardLayout's shared
 * `ReportFilterSidebar`, fed by whatever this page registers into
 * `RightPanelContext`. This test renders the REAL provider (mirrors the
 * OpportunitiesPage.test.tsx pattern) and asserts on the registered group
 * directly — exactly the seam a real click on the topbar's filter button and a
 * chip in the panel would drive. Every heavy `*Report` sub-page is mocked to a
 * thin stub so this stays a panel-wiring test, not a re-test of each report.
 *
 * WAVE 1c (2026-08-25): opportunities/outreach/whatsapp joined the filterable
 * set, and candidates/applications/matches/tasks each gained their own extra
 * per-page dimension groups (PLAN-RAPPORTEN-V3 §a) — every new lookup source
 * this page now reads is stubbed below the same way the pre-existing ones are.
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
const candidateLookups = { statuses: candidateStatusOptions, phases: [], candidateTypes: [] }
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
const taskTypeIdOptions: Array<{ value: string; label: string }> = []
const taskPriorityIdOptions: Array<{ value: string; label: string }> = []
const matchStatusesValue = { statuses: [{ value: 'open', label: 'Active' }] }
const customerOptionsValue: Array<{ value: string; label: string }> = []
vi.mock('./reportStatusLookups', () => ({
  useVacancyStatusIdOptions: () => vacancyStatusOptions,
  useTaskStatusIdOptions: () => taskStatusOptions,
  useTaskTypeIdOptions: () => taskTypeIdOptions,
  useTaskPriorityIdOptions: () => taskPriorityIdOptions,
}))
vi.mock('@/lib/useMatchStatuses', () => ({ useMatchStatuses: () => matchStatusesValue }))
vi.mock('@/pages/vacancies/hooks/useCustomerOptions', () => ({ useCustomerOptions: () => customerOptionsValue }))
// WAVE 1c lookup sources — every filterable report's own extra-dimension vocabulary.
// STABLE-REFERENCE CONTRACT: every mocked lookup returns the SAME object each
// render — a fresh literal per call re-derives panelGroups every render and
// drives the register/unregister effect into an infinite loop (the suite hung
// forever on exactly that, Opus wave-B2).
const stableLookup = vi.hoisted(() => ({
  stages: { stages: [] as unknown[] }, statuses: { statuses: [] as unknown[] }, sources: { sources: [] as unknown[] },
  appStages: { stages: [] as unknown[] }, reasons: { reasons: [] as unknown[] }, teams: { teams: [] as unknown[] },
  stopReasons: { reasons: [] as unknown[] },
}))
vi.mock('@/lib/useOpportunityStages', () => ({ useOpportunityStages: () => stableLookup.stages }))
vi.mock('@/lib/useOutreachStatuses', () => ({ useOutreachStatuses: () => stableLookup.statuses }))
vi.mock('@/lib/useApplicationSources', () => ({ useApplicationSources: () => stableLookup.sources }))
vi.mock('@/hooks/useApplicationStages', () => ({ useApplicationStages: () => stableLookup.appStages }))
vi.mock('@/lib/useRejectionReasons', () => ({ useRejectionReasons: () => stableLookup.reasons }))
vi.mock('@/lib/useTeams', () => ({ useTeams: () => stableLookup.teams }))
vi.mock('@/pages/matches/shared', () => ({ useMatchStopReasons: () => stableLookup.stopReasons }))

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
// outreach/whatsapp both joined FILTERABLE_REPORT_IDS in WAVE 1c — their stubs
// now assert on `filters` too, the same as every other filterable report.
vi.mock('./OutreachReport', () => ({
  default: ({ period, filters }: { period: string; filters?: unknown }) => (
    <div data-testid="outreach-period" data-filters={JSON.stringify(filters ?? null)}>{period}</div>
  ),
}))
vi.mock('./WhatsappReport', () => ({
  default: ({ period, filters }: { period: string; filters?: unknown }) => (
    <div data-testid="whatsapp-period" data-filters={JSON.stringify(filters ?? null)}>{period}</div>
  ),
}))
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
  it('registers period + compare + status/owner/branch + the candidate dimensions (source/phase/contractForm)', () => {
    const { getGroups } = renderPage()
    const groups = getGroups()
    expect(groups.map(g => g.key)).toEqual(['period', 'compare', 'status', 'owner', 'branch', 'source', 'phase', 'contractForm'])
  })

  it('registers period + compare + status/owner/branch for outreach — the shared trio, no per-page dimension of its own', () => {
    let latest: RadioGroup[] = []
    render(
      <RightPanelProvider>
        <Capture onGroups={g => { latest = g }} />
        <ReportsPage reportId="outreach" />
      </RightPanelProvider>,
    )
    expect(latest.map(g => g.key)).toEqual(['period', 'compare', 'status', 'owner', 'branch'])
    expect(screen.getByTestId('outreach-period').textContent).toBe('month')
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
    expect(filters).toMatchObject({ status: [], ownerId: ['u1'], locationId: [], customerId: [] })
  })

  // RAPPORT-FILTERS-2: vacancies/applications also get the customer_id[] group
  // (client_id-backed); applications additionally gets its own WAVE 1c trio
  // (stage/source/rejectionReason — vacancy_id stays unwired, no lookup hook).
  it('registers period + status/owner/branch/customer for vacancies, and the same plus stage/source/rejectionReason for applications', () => {
    let latest: RadioGroup[] = []
    const { unmount } = render(
      <RightPanelProvider>
        <Capture onGroups={g => { latest = g }} />
        <ReportsPage reportId="vacancies" />
      </RightPanelProvider>,
    )
    expect(latest.map(g => g.key)).toEqual(['period', 'compare', 'status', 'owner', 'branch', 'customer'])
    unmount()

    render(
      <RightPanelProvider>
        <Capture onGroups={g => { latest = g }} />
        <ReportsPage reportId="applications" />
      </RightPanelProvider>,
    )
    expect(latest.map(g => g.key)).toEqual(['period', 'compare', 'status', 'owner', 'branch', 'customer', 'stage', 'source', 'rejectionReason'])
  })

  it('registers period + status/owner/branch + customerIds/origin/contractForm for matches (stopReason deliberately absent: the envelope never applies it) — never the singular customer group', () => {
    let latest: RadioGroup[] = []
    render(
      <RightPanelProvider>
        <Capture onGroups={g => { latest = g }} />
        <ReportsPage reportId="matches" />
      </RightPanelProvider>,
    )
    expect(latest.map(g => g.key)).toEqual(['period', 'compare', 'status', 'owner', 'branch', 'customerIds', 'origin', 'contractForm'])
  })

  it('registers period + status/owner/branch + taskType/priority/team for tasks — never a customer group (no customer column on tasks)', () => {
    let latest: RadioGroup[] = []
    render(
      <RightPanelProvider>
        <Capture onGroups={g => { latest = g }} />
        <ReportsPage reportId="tasks" />
      </RightPanelProvider>,
    )
    expect(latest.map(g => g.key)).toEqual(['period', 'compare', 'status', 'owner', 'branch', 'taskType', 'priority', 'team'])
  })

  it('registers period + owner/direction/escalated for whatsapp — status/branch are dropped (WHATSAPP-NARROW-1)', () => {
    let latest: RadioGroup[] = []
    render(
      <RightPanelProvider>
        <Capture onGroups={g => { latest = g }} />
        <ReportsPage reportId="whatsapp" />
      </RightPanelProvider>,
    )
    expect(latest.map(g => g.key)).toEqual(['period', 'owner', 'direction', 'escalated'])
    expect(screen.getByTestId('whatsapp-period').textContent).toBe('month')
  })

  it('registers period + status/owner/branch/customer + a value number-range for opportunities', () => {
    let latest: RadioGroup[] = []
    render(
      <RightPanelProvider>
        <Capture onGroups={g => { latest = g }} />
        <ReportsPage reportId="opportunities" />
      </RightPanelProvider>,
    )
    expect(latest.map(g => g.key)).toEqual(['period', 'compare', 'status', 'owner', 'branch', 'customer', 'value'])
  })

  it('sends the active vacancies panel filters to the report AS its filters prop (bar and lade share one state)', () => {
    render(
      <RightPanelProvider>
        <ReportsPage reportId="vacancies" />
      </RightPanelProvider>,
    )
    const filters = JSON.parse(screen.getByTestId('report-period').dataset.filters ?? 'null')
    expect(filters).toMatchObject({ status: [], ownerId: [], locationId: [], customerId: [] })
  })

  // WAVE 1c: every report on REPORT_IDS is now on FILTERABLE_REPORT_IDS too (the
  // last three holdouts — opportunities/outreach/whatsapp — joined this wave), so
  // the "a non-filterable report never receives filters" case no longer has a
  // page left to exercise it. An unknown/stale route id still falls back to the
  // first report (candidates) per ReportsPage's own resolution rule, which is
  // covered by the root-vs-sub-report describe block below.

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
        <ReportsPage reportId="customers" />
      </RightPanelProvider>,
    )
    expect(container.querySelectorAll('button')).toHaveLength(0)
  })

  it('the period group only ever carries the period param on an unfilterable report', () => {
    let latest: RadioGroup[] = []
    render(
      <RightPanelProvider>
        <Capture onGroups={g => { latest = g }} />
        <ReportsPage reportId="customers" />
      </RightPanelProvider>,
    )
    const periodGroup = latest[0]
    const params = buildReportQueryParams((periodGroup.selected?.[0] as 'day' | 'week' | 'month') ?? 'month')
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
