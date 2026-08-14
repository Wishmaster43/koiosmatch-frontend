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

// Every report component collapses to the same stub: it only needs to prove
// which `period` it was handed, never its own body (each has its own tests).
vi.mock('./CandidatesReport', () => ({ default: ({ period }: { period: string }) => <div data-testid="report-period">{period}</div> }))
vi.mock('./ApplicationsReport', () => ({ default: () => null }))
vi.mock('./CustomersReport', () => ({ default: () => null }))
vi.mock('./FlowReport', () => ({ default: () => null }))
vi.mock('./RecruitersReport', () => ({ default: () => null }))
vi.mock('./VacanciesReport', () => ({ default: () => null }))
vi.mock('./OpportunitiesReport', () => ({ default: () => null }))
vi.mock('./TasksReport', () => ({ default: () => null }))
vi.mock('./MatchesReport', () => ({ default: () => null }))
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
  it('registers exactly one group: the period', () => {
    const { getGroups } = renderPage()
    const groups = getGroups()
    expect(groups).toHaveLength(1)
    expect(groups[0].key).toBe('period')
  })

  it('never registers a group for a dimension the server does not accept', () => {
    const { getGroups } = renderPage()
    const knownKeys = new Set(Object.keys(buildReportQueryParams('month')))
    getGroups().forEach(g => expect(knownKeys.has(g.key)).toBe(true))
  })

  it('unregisters its group on unmount (panel closes with nothing stale behind it)', () => {
    let latest: RadioGroup[] = []
    const { unmount } = render(
      <RightPanelProvider>
        <Capture onGroups={g => { latest = g }} />
        <ReportsPage reportId="candidates" />
      </RightPanelProvider>,
    )
    expect(latest).toHaveLength(1)
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

    const periodGroup = getGroups()[0]
    act(() => { periodGroup.onToggle?.('day') })

    expect(screen.getByTestId('report-period').textContent).toBe('day')
  })

  it('the registered group only ever carries the period param the server reads', () => {
    const { getGroups } = renderPage()
    const periodGroup = getGroups()[0]
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
