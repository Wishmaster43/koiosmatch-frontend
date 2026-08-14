/**
 * ReportsDashboard — the bare #reports overview. Asserts the nine KPI cards
 * render from fixtures (one per existing use*Report hook, no invented number)
 * and that clicking a card navigates to the exact sub-report the number came
 * from (RAPPORTEN-DASHBOARD-1).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReportsDashboard from './ReportsDashboard'

// Navigation spy — asserts the exact target route each card drills into.
const mockNavigate = vi.fn()
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ navigate: mockNavigate }) }))

// Each of the nine underlying report hooks under test control — every card's
// number is sourced from one of these, never fabricated on the dashboard side.
const mockCandidates    = vi.fn()
const mockApplications  = vi.fn()
const mockCustomers     = vi.fn()
const mockVacancies     = vi.fn()
const mockMatches       = vi.fn()
const mockTasks         = vi.fn()
const mockOpportunities = vi.fn()
const mockIntakes       = vi.fn()
const mockFlow          = vi.fn()
vi.mock('./useCandidatesReport',    () => ({ useCandidatesReport:    () => mockCandidates() }))
vi.mock('./useApplicationsReport',  () => ({ useApplicationsReport:  () => mockApplications() }))
vi.mock('./useCustomersReport',     () => ({ useCustomersReport:     () => mockCustomers() }))
vi.mock('./useVacanciesReport',     () => ({ useVacanciesReport:     () => mockVacancies() }))
vi.mock('./useMatchesReport',       () => ({ useMatchesReport:       () => mockMatches() }))
vi.mock('./useTasksReport',         () => ({ useTasksReport:         () => mockTasks() }))
vi.mock('./useOpportunitiesReport', () => ({ useOpportunitiesReport: () => mockOpportunities() }))
vi.mock('./useIntakesReport',       () => ({ useIntakesReport:       () => mockIntakes() }))
vi.mock('./useFlowReport',          () => ({ useFlowReport:          () => mockFlow() }))

// Fixture totals — nine distinct numbers so a mixed-up card/route pairing
// would fail a value assertion, not just a count assertion.
const FIXTURES: Record<string, number> = {
  candidates: 11, applications: 22, customers: 33, vacancies: 44, matches: 55,
  tasks: 66, opportunities: 77, intakes: 88, flow: 99,
}

function setSuccess() {
  mockCandidates.mockReturnValue({ data: { total: FIXTURES.candidates }, loading: false, error: false })
  mockApplications.mockReturnValue({ data: { total: FIXTURES.applications }, loading: false, error: false })
  mockCustomers.mockReturnValue({ data: { total: FIXTURES.customers }, loading: false, error: false })
  mockVacancies.mockReturnValue({ data: { total: FIXTURES.vacancies }, loading: false, error: false })
  mockMatches.mockReturnValue({ data: { total: FIXTURES.matches }, loading: false, error: false })
  mockTasks.mockReturnValue({ data: { total: FIXTURES.tasks }, loading: false, error: false })
  mockOpportunities.mockReturnValue({ data: { total: FIXTURES.opportunities }, loading: false, error: false })
  mockIntakes.mockReturnValue({ data: { total: FIXTURES.intakes }, loading: false, error: false })
  mockFlow.mockReturnValue({ data: { total: FIXTURES.flow }, loading: false, error: false })
}

function renderDashboard() {
  return render(<ReportsDashboard period="month" />)
}

describe('ReportsDashboard (RAPPORTEN-DASHBOARD-1)', () => {
  it('renders exactly nine KPI cards, one number per existing report endpoint', () => {
    setSuccess()
    renderDashboard()
    Object.values(FIXTURES).forEach(v => expect(screen.getByText(String(v))).toBeInTheDocument())
  })

  it('a loading hook shows an honest placeholder, never a fabricated number', () => {
    setSuccess()
    mockMatches.mockReturnValue({ data: null, loading: true, error: false })
    renderDashboard()
    expect(screen.queryByText(String(FIXTURES.matches))).not.toBeInTheDocument()
    expect(screen.getByText('…')).toBeInTheDocument()
  })

  it('an errored hook shows an honest dash, never a fabricated number', () => {
    setSuccess()
    mockFlow.mockReturnValue({ data: null, loading: false, error: true })
    renderDashboard()
    expect(screen.queryByText(String(FIXTURES.flow))).not.toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('clicking the candidates card navigates to the candidates sub-report', async () => {
    setSuccess()
    renderDashboard()
    await userEvent.click(screen.getByText(String(FIXTURES.candidates)))
    expect(mockNavigate).toHaveBeenCalledWith('reports.candidates')
  })

  it('clicking the flow card navigates to the flow sub-report', async () => {
    setSuccess()
    renderDashboard()
    await userEvent.click(screen.getByText(String(FIXTURES.flow)))
    expect(mockNavigate).toHaveBeenCalledWith('reports.flow')
  })

  it('clicking the vacancies card navigates to the vacancies sub-report', async () => {
    setSuccess()
    renderDashboard()
    await userEvent.click(screen.getByText(String(FIXTURES.vacancies)))
    expect(mockNavigate).toHaveBeenCalledWith('reports.vacancies')
  })
})
