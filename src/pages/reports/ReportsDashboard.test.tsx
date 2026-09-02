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
// PART A/B: the hub's attention section + chart grid read this hook directly
// (ReportsHubAttention) — separate from the nine report hooks above.
const mockHub = vi.fn()
vi.mock('./useReportsHub', () => ({
  useReportsHub: () => mockHub(),
  isReportsHubForbidden: (e: unknown) => (e as { response?: { status?: number } })?.response?.status === 403,
}))
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
  mockHub.mockReturnValue({
    data: { signals: HUB_CARDS }, loading: false, error: false, errorObject: undefined, refetch: vi.fn(),
  })
}

// Nine hub cards fixture — mirrors ReportsHubService::summary()'s shape.
// Non-zero counts throughout: a literal "0" is asserted absent elsewhere in
// this file (RAPPORTEN-DASHBOARD-1's own "no padded zero" test) — the
// zero-count/calm-tint case gets its own dedicated fixture below.
const HUB_CARDS = [
  { key: 'candidates_no_follow_up', label: 'Kandidaten zonder opvolging', count: 3, report: 'candidates', filters: { no_contact_due: 1 } },
  { key: 'vacancies_stale_online', label: 'Vacatures online zonder sollicitanten', count: 6, report: 'vacancies', filters: { stale_online: 1 } },
  { key: 'matches_expiring', label: 'Matches die aflopen', count: 5, report: 'matches', filters: {} },
  { key: 'tasks_overdue', label: 'Taken over tijd', count: 2, report: 'tasks', filters: { overdue: 1 } },
  { key: 'customers_no_contact', label: 'Klanten lang geen contact', count: 7, report: 'customers', filters: {} },
  { key: 'leads_pending', label: 'Leads te lang pending', count: 1, report: 'candidates', filters: {} },
  { key: 'documents_expiring', label: 'Kandidaten met verlopend document', count: 9, report: 'candidates', filters: {} },
  { key: 'vacancies_open', label: 'Openstaande posities', count: 8, report: 'vacancies', filters: {} },
  { key: 'conversations_unanswered', label: 'Conversaties zonder reactie', count: 4, report: 'conversations', filters: {} },
]

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

// PART A: the hub attention block — a LIST of the non-zero signals from
// GET /reports (never a second nine-card strip: Danny 31-08 "dubbele KPI's").
describe('ReportsDashboard · attention block (PART A)', () => {
  it('lists the non-zero signals as rows and clicking one navigates to its sub-report', async () => {
    setSuccess()
    renderDashboard()
    expect(screen.getByText('Vraagt aandacht')).toBeInTheDocument()
    expect(screen.getByText('Kandidaten zonder opvolging')).toBeInTheDocument()
    expect(screen.getByText('Taken over tijd')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '3 Kandidaten zonder opvolging' }))
    expect(mockNavigate).toHaveBeenCalledWith('reports.candidates')
  })

  it('hides zero signals and shows the calm empty line when nothing needs attention', () => {
    setSuccess()
    mockHub.mockReturnValue({
      data: { signals: HUB_CARDS.map(c => ({ ...c, count: 0 })) }, loading: false, error: false, errorObject: undefined, refetch: vi.fn(),
    })
    renderDashboard()
    expect(screen.queryByText('Kandidaten zonder opvolging')).not.toBeInTheDocument()
    expect(screen.getByText('Geen aandachtspunten: alles is bij.')).toBeInTheDocument()
  })

  it('routes the conversations signal to the WhatsApp report (no own page)', async () => {
    setSuccess()
    renderDashboard()
    await userEvent.click(screen.getByRole('button', { name: '4 Conversaties zonder reactie' }))
    expect(mockNavigate).toHaveBeenCalledWith('reports.whatsapp')
  })

  it('still renders the KPI band when the hub errors, and shows the error block', () => {
    setSuccess()
    mockHub.mockReturnValue({ data: null, loading: false, error: true, errorObject: { response: { status: 500 } }, refetch: vi.fn() })
    renderDashboard()
    expect(screen.getByText(String(FIXTURES.candidates))).toBeInTheDocument()
    expect(screen.getByText('De aandachtssignalen konden niet worden geladen')).toBeInTheDocument()
  })

  it('renders nothing for the attention block on a 403 (no reports.view), KPI band stays', () => {
    setSuccess()
    mockHub.mockReturnValue({ data: null, loading: false, error: true, errorObject: { response: { status: 403 } }, refetch: vi.fn() })
    renderDashboard()
    expect(screen.getByText(String(FIXTURES.candidates))).toBeInTheDocument()
    expect(screen.queryByText('Vraagt aandacht')).not.toBeInTheDocument()
  })
})

// PART B: the chart grid — titles render once the underlying report hooks resolve.
describe('ReportsDashboard · chart grid (PART B)', () => {
  it('renders the six chart block titles', () => {
    setSuccess()
    renderDashboard()
    expect(screen.getByText('Sollicitaties over tijd')).toBeInTheDocument()
    expect(screen.getByText('Sollicitatiefunnel')).toBeInTheDocument()
    expect(screen.getByText('Kandidaten per bron')).toBeInTheDocument()
    expect(screen.getByText('Vervullingspercentage vacatures')).toBeInTheDocument()
    expect(screen.getByText('Matches onder contract')).toBeInTheDocument()
    expect(screen.getByText('Taken per status')).toBeInTheDocument()
  })
})
