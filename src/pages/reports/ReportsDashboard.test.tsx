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
const mockOutreach      = vi.fn()
const mockWhatsapp      = vi.fn()
vi.mock('./useCandidatesReport',    () => ({ useCandidatesReport:    () => mockCandidates() }))
vi.mock('./useApplicationsReport',  () => ({ useApplicationsReport:  () => mockApplications() }))
vi.mock('./useCustomersReport',     () => ({ useCustomersReport:     () => mockCustomers() }))
vi.mock('./useVacanciesReport',     () => ({ useVacanciesReport:     () => mockVacancies() }))
vi.mock('./useMatchesReport',       () => ({ useMatchesReport:       () => mockMatches() }))
vi.mock('./useTasksReport',         () => ({ useTasksReport:         () => mockTasks() }))
vi.mock('./useOpportunitiesReport', () => ({ useOpportunitiesReport: () => mockOpportunities() }))
vi.mock('./useOutreachReport',      () => ({ useOutreachReport:      () => mockOutreach() }))
vi.mock('./useWhatsappReport',      () => ({ useWhatsappReport:      () => mockWhatsapp() }))
// Module gate: the whatsapp tile only exists for tenants WITH the module — the
// controllable mock lets the no-module test flip it off.
const mockHasModule = vi.fn<(m: string) => boolean>(() => true)
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasModule: (m: string) => mockHasModule(m) }) }))

// Fixture totals — nine distinct numbers so a mixed-up card/route pairing
// would fail a value assertion, not just a count assertion.
const FIXTURES: Record<string, number> = {
  candidates: 11, applications: 22, customers: 33, vacancies: 44, matches: 55,
  tasks: 66, opportunities: 77, outreach: 99, whatsapp: 111,
}

function setSuccess() {
  mockCandidates.mockReturnValue({ data: { total: FIXTURES.candidates }, loading: false, error: false })
  mockApplications.mockReturnValue({ data: { total: FIXTURES.applications }, loading: false, error: false })
  mockCustomers.mockReturnValue({ data: { total: FIXTURES.customers }, loading: false, error: false })
  mockVacancies.mockReturnValue({ data: { total: FIXTURES.vacancies }, loading: false, error: false })
  mockMatches.mockReturnValue({ data: { total: FIXTURES.matches }, loading: false, error: false })
  mockTasks.mockReturnValue({ data: { total: FIXTURES.tasks }, loading: false, error: false })
  mockOpportunities.mockReturnValue({ data: { total: FIXTURES.opportunities }, loading: false, error: false })
  mockOutreach.mockReturnValue({ data: { total: FIXTURES.outreach }, loading: false, error: false })
  // Whatsapp's LIVE envelope nests its window/total under `meta` (CMBE f7a2c6f8).
  mockWhatsapp.mockReturnValue({ data: { meta: { total: FIXTURES.whatsapp } }, loading: false, error: false })
}

function renderDashboard() {
  return render(<ReportsDashboard period="month" />)
}

describe('ReportsDashboard (RAPPORTEN-DASHBOARD-1)', () => {
  it('renders one KPI card per surviving report endpoint (whatsapp joins with its page)', () => {
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
    mockOutreach.mockReturnValue({ data: null, loading: false, error: true })
    renderDashboard()
    expect(screen.queryByText(String(FIXTURES.outreach))).not.toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('a resolved hook with no total renders the house dash, never a padded zero', () => {
    setSuccess()
    mockOpportunities.mockReturnValue({ data: { total: null }, loading: false, error: false })
    renderDashboard()
    expect(screen.queryByText(String(FIXTURES.opportunities))).not.toBeInTheDocument()
    // '0' must never stand in for a total the server didn't send.
    expect(screen.queryByText('0')).not.toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('clicking the candidates card navigates to the candidates sub-report', async () => {
    setSuccess()
    renderDashboard()
    await userEvent.click(screen.getByText(String(FIXTURES.candidates)))
    expect(mockNavigate).toHaveBeenCalledWith('reports.candidates')
  })

  // RAPPORTEN-DANNY10-1: the flow tile retired with its page; outreach holds
  // the ninth card and must drill into its own sub-report.
  it('clicking the outreach card navigates to the outreach sub-report', async () => {
    setSuccess()
    renderDashboard()
    await userEvent.click(screen.getByText(String(FIXTURES.outreach)))
    expect(mockNavigate).toHaveBeenCalledWith('reports.outreach')
  })

  it('clicking the vacancies card navigates to the vacancies sub-report', async () => {
    setSuccess()
    renderDashboard()
    await userEvent.click(screen.getByText(String(FIXTURES.vacancies)))
    expect(mockNavigate).toHaveBeenCalledWith('reports.vacancies')
  })

  // RAPPORTEN-WHATSAPP-FE-1: whatsapp joins as the tenth tile, ninth card.
  it('clicking the whatsapp card navigates to the whatsapp sub-report', async () => {
    setSuccess()
    renderDashboard()
    await userEvent.click(screen.getByText(String(FIXTURES.whatsapp)))
    expect(mockNavigate).toHaveBeenCalledWith('reports.whatsapp')
  })
})

// Danny 24-08: tiles wear the sidebar names in the sidebar (REPORT_IDS) order.
describe('ReportsDashboard · sidebar parity', () => {
  it('renders the nine tiles in REPORT_IDS order with the tabs.* labels', () => {
    setSuccess()
    renderDashboard()
    const values = ['11', '22', '33', '44', '77', '66', '55', '99', '111']
    const rendered = screen.getAllByText(/^(11|22|33|44|55|66|77|99|111)$/).map(el => el.textContent)
    expect(rendered).toEqual(values)
  })
})

// RAPPORTEN-WHATSAPP-FE-1: without the whatsapp module the tile hides entirely —
// never a 403 tile on every hub visit for a core-package tenant.
describe('ReportsDashboard · whatsapp module gate', () => {
  it('hides the whatsapp tile when the tenant lacks the module', () => {
    setSuccess()
    mockHasModule.mockReturnValue(false)
    renderDashboard()
    expect(screen.queryByText(String(FIXTURES.whatsapp))).not.toBeInTheDocument()
    mockHasModule.mockReturnValue(true)
  })
})
