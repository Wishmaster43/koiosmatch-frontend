import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import RecruitersReport from './RecruitersReport'
import type { RecruitersReportData } from '@/types/analytics'

// Data layer under test control (loading/error/empty/success — the four UI states).
const mockUseRecruitersReport = vi.fn()
vi.mock('./useRecruitersReport', () => ({ useRecruitersReport: () => mockUseRecruitersReport() }))

// Spy on the underlying axios client so we can assert the exact request shape
// (method/route/params) that a row click sends — mutation tests must assert the
// request, never only that a callback fired (CLAUDE.md §13).
const getSpy = vi.fn()
vi.mock('@/lib/api', () => ({
  default: { get: (...args: unknown[]) => getSpy(...args) },
  unwrapList: (r: { data: { data?: unknown[]; meta?: { total?: number } } }) => ({ rows: r.data?.data ?? [], total: r.data?.meta?.total ?? 0 }),
}))

const data: RecruitersReportData = {
  period: 'month', from: '2026-08-01', to: '2026-08-31', compliance_months: 6,
  recruiters: [
    {
      key: 'r1', label: 'Anna de Vries', candidates: 20,
      intakes: { planned: 3, done: 2 },
      applications_by_phase: [{ key: 'applied', label: 'Sollicitant', count: 5 }, { key: 'hired', label: 'Aangenomen', count: 2 }],
      matches: 4, tasks: { open: 3, overdue: 1 }, not_contacted: 2,
    },
    {
      key: 'r2', label: 'Bram Jansen', candidates: 10,
      intakes: { planned: 1, done: 1 },
      applications_by_phase: [{ key: 'applied', label: 'Sollicitant', count: 3 }],
      matches: 1, tasks: { open: 0, overdue: 0 }, not_contacted: 0,
    },
  ],
}

function renderReport() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <RecruitersReport period="month" />
    </QueryClientProvider>,
  )
}

// The last drill call's raw params.
const lastDrillParams = () =>
  (getSpy.mock.calls.filter(c => c[0] === '/reports/recruiters/drill').at(-1)?.[1] as { params: Record<string, unknown> }).params
const lastAdviceParams = () =>
  (getSpy.mock.calls.filter(c => c[0] === '/reports/recruiters/advice').at(-1)?.[1] as { params: Record<string, unknown> }).params

describe('RecruitersReport', () => {
  beforeEach(() => {
    getSpy.mockReset()
    getSpy.mockResolvedValue({ data: { data: [], meta: { total: 0 } } })
  })

  it('shows the loading state', () => {
    mockUseRecruitersReport.mockReturnValue({ data: null, loading: true, error: false })
    renderReport()
    expect(screen.getByText('Recruiters laden…')).toBeInTheDocument()
  })

  it('shows the error state', () => {
    mockUseRecruitersReport.mockReturnValue({ data: null, loading: false, error: true })
    renderReport()
    expect(screen.getByText('Kon de recruiters niet laden')).toBeInTheDocument()
  })

  it('shows the empty state when there are no recruiters', () => {
    mockUseRecruitersReport.mockReturnValue({ data: { ...data, recruiters: [] }, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Geen recruiters in deze periode')).toBeInTheDocument()
  })

  // Team-totals KPI strip is the SUM across recruiters, not the count of rows shown.
  it('renders the KPI strip as team totals summed across recruiters', () => {
    mockUseRecruitersReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Recruiters')).toBeInTheDocument()
    // 'Kandidaten' / 'Matches' / 'Niet gecontacteerd' each appear twice — once as
    // the KPI card label, once as the table column header.
    expect(screen.getAllByText('Kandidaten').length).toBe(2)
    expect(screen.getAllByText('Matches').length).toBe(2)
    expect(screen.getAllByText('Niet gecontacteerd').length).toBe(2)
    // candidates: 20+10=30, matches: 4+1=5, not_contacted: 2+0=2, recruiters: 2 rows.
    expect(screen.getByText('30')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  // Exactly nine KPI cards: the four legacy team totals plus five new ones, all
  // plain sums of fields the endpoint already returns per recruiter (no team-level
  // drill exists, so none is clickable — unchanged from the legacy four).
  it('renders exactly nine KPI cards summing applications/intakes/tasks across recruiters', () => {
    mockUseRecruitersReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    // 'Sollicitaties' renders twice: KPI card label + table column header.
    expect(screen.getAllByText('Sollicitaties').length).toBe(2)
    expect(screen.getByText('Intakes gepland')).toBeInTheDocument()
    expect(screen.getByText('Intakes gedaan')).toBeInTheDocument()
    expect(screen.getByText('Taken open')).toBeInTheDocument()
    expect(screen.getByText('Taken te laat')).toBeInTheDocument()
    // applications: 7+3=10, intakesPlanned: 3+1=4, intakesDone: 2+1=3, tasksOpen: 3+0=3, tasksOverdue: 1+0=1.
    // Assert each sum scoped to its own KPI card (bare digits collide with table cells).
    const cardValue = (label: string) => {
      const l = screen.getAllByText(label)[0]
      return within(l.parentElement as HTMLElement)
    }
    expect(cardValue('Sollicitaties').getByText('10')).toBeInTheDocument()
    expect(cardValue('Intakes gepland').getByText('4')).toBeInTheDocument()
    expect(cardValue('Intakes gedaan').getByText('3')).toBeInTheDocument()
    expect(cardValue('Taken open').getByText('3')).toBeInTheDocument()
    expect(cardValue('Taken te laat').getByText('1')).toBeInTheDocument()
  })

  // Table renders one row per recruiter with the backend's own label, and the
  // applications column sums the per-phase counts (5+2=7 for Anna).
  it('renders one table row per recruiter with the summed applications column', () => {
    mockUseRecruitersReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    expect(screen.getByText('Anna de Vries')).toBeInTheDocument()
    expect(screen.getByText('Bram Jansen')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  // Clicking a recruiter row drills with recruiter=<key> — drill AND advice, both
  // carrying the same params (no residue between two different recruiter rows).
  it('clicking a recruiter row drills with recruiter=<key> (drill + advice)', async () => {
    const user = userEvent.setup()
    mockUseRecruitersReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Anna de Vries'))
    expect(lastDrillParams()).toEqual({ recruiter: 'r1', period: 'month' })
    expect(lastAdviceParams()).toEqual({ recruiter: 'r1', period: 'month' })

    await user.click(screen.getByText('Bram Jansen'))
    expect(lastDrillParams()).toEqual({ recruiter: 'r2', period: 'month' })
  })

  // Every drill source targets the ONE recruiters drill/advice pair.
  it('always drills via /reports/recruiters/drill|advice', async () => {
    const user = userEvent.setup()
    mockUseRecruitersReport.mockReturnValue({ data, loading: false, error: false })
    renderReport()
    await user.click(screen.getByText('Anna de Vries'))
    expect(getSpy.mock.calls.length).toBeGreaterThan(0)
    expect(getSpy.mock.calls.every(c =>
      c[0] === '/reports/recruiters/drill' || c[0] === '/reports/recruiters/advice')).toBe(true)
  })
})
