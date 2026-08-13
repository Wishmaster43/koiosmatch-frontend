/**
 * CustomerApplicationsList — the Sollicitaties sub-tab's own render coverage:
 * columns (candidate/vacancy/phase/score/created), the phase filter narrowing
 * rows, free-text search, the four explicit UI states, and the row click
 * opening the application (never the candidate/vacancy on either side of it).
 * The FETCH shape itself is proven separately (useCustomerApplications.test.ts,
 * useApplicationsByVacancyIds.test.ts, mirrors MatchesTab.test.tsx deferring to
 * useCustomerMatches.test.ts) — this file stubs both hooks so it only tests
 * rendering, not the network seam. SOLLICITATIES-SCOPE-1 added the second entry
 * mode (`vacancyIds`, the location/department drill-down) — both hooks are
 * called unconditionally by the component (Rules of Hooks), so BOTH need a
 * default return value here even in tests that only exercise one mode.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@/i18n'
import CustomerApplicationsList from './CustomerApplicationsList'
import type { Application } from '@/types/application'

const mockUseCustomerApplications = vi.fn()
const mockUseApplicationsByVacancyIds = vi.fn()
vi.mock('../hooks/useCustomerDrawerData', () => ({
  useCustomerApplications: (...args: unknown[]) => mockUseCustomerApplications(...args),
  useApplicationsByVacancyIds: (...args: unknown[]) => mockUseApplicationsByVacancyIds(...args),
}))

// Two funnel stages so the phase filter has real options to narrow on — mirrors
// ApplicationDrawer.test.tsx's own useLookups stub.
const FUNNEL_TYPES = [
  { value: 'applied', label: 'Aangemeld', color: 'var(--color-info)' },
  { value: 'hired', label: 'Aangenomen', color: 'var(--color-success)' },
]
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({
    funnelTypes: FUNNEL_TYPES,
    funnelMeta: (v?: string) => FUNNEL_TYPES.find(f => f.value === v) ?? { label: v ?? '', color: 'var(--text-muted)' },
  }),
}))

const openEntity = vi.fn()
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity, navigate: vi.fn() }) }))

// S-custlist-1's pencil reuses the candidate drawer's own edit form — stubbed
// here, its own test coverage lives on that component.
vi.mock('@/pages/candidates/drawer/AddApplicationModal', () => ({ default: () => null }))
// The lazy detail panel's own request — never asserted here (ApplicationRowDetails
// has its own test file); a resolved empty object keeps it from hanging.
vi.mock('@/lib/api', () => ({ default: { get: vi.fn(() => Promise.resolve({ data: { data: {} } })) }, unwrap: (r: unknown) => (r as { data?: { data?: unknown } })?.data?.data ?? {} }))

const row = (over: Partial<Application> = {}): Application => ({
  id: 'app-1', candidateId: 'cand-1', candidateName: 'Jane Doe', candidateInitials: 'JD',
  vacancyId: 'vac-1', vacancyTitle: 'Verpleegkundige', client: 'Acme', customerId: 'cust-1',
  referenceNumber: 'S-001', score: 82, task: '', phaseKey: 'applied', bucket: 'active',
  interview: null, source: '', owner: { id: null, name: '', initials: '', color: null },
  candidateStatusLabel: '', candidateStatusColor: 'var(--text-muted)', candidateStatus: '', candidatePhase: '',
  created: '2026-07-01', isNew: false, archived: false, deletedAt: null, currentStageEnteredAt: null,
  missingAppointment: false,
  ...over,
})

afterEach(() => cleanup())
beforeEach(() => {
  vi.clearAllMocks()
  // The customer-mode tests below only ever set up mockUseCustomerApplications —
  // the OTHER hook still fires (Rules of Hooks) with an empty vacancyIds array,
  // so it needs a harmless default return too.
  mockUseApplicationsByVacancyIds.mockReturnValue({ rows: [], loading: false, error: false })
})

describe('CustomerApplicationsList', () => {
  it('shows the loading state', () => {
    mockUseCustomerApplications.mockReturnValue({ rows: [], loading: true, error: false })
    render(<CustomerApplicationsList customerId="cust-1" />)
    expect(screen.getByText('Sollicitaties laden…')).toBeInTheDocument()
  })

  it('shows an honest error message, never a silently empty table', () => {
    mockUseCustomerApplications.mockReturnValue({ rows: [], loading: false, error: true })
    render(<CustomerApplicationsList customerId="cust-1" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Sollicitaties laden is mislukt.')
  })

  it('shows the empty state with no rows', () => {
    mockUseCustomerApplications.mockReturnValue({ rows: [], loading: false, error: false })
    render(<CustomerApplicationsList customerId="cust-1" />)
    expect(screen.getByText('Nog geen sollicitaties.')).toBeInTheDocument()
  })

  it('renders a fixture row with its phase pill and score', () => {
    mockUseCustomerApplications.mockReturnValue({ rows: [row()], loading: false, error: false })
    render(<CustomerApplicationsList customerId="cust-1" />)
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('Verpleegkundige')).toBeInTheDocument()
    expect(screen.getByText('Aangemeld')).toBeInTheDocument()
    expect(screen.getByText('82%')).toBeInTheDocument()
  })

  it('narrows rows on free-text search over candidate + vacancy', async () => {
    const user = userEvent.setup()
    mockUseCustomerApplications.mockReturnValue({
      rows: [row(), row({ id: 'app-2', candidateName: 'John Smith', vacancyTitle: 'Arts' })],
      loading: false, error: false,
    })
    render(<CustomerApplicationsList customerId="cust-1" />)
    expect(screen.getByText('John Smith')).toBeInTheDocument()
    await user.type(screen.getByPlaceholderText('Zoek naar sollicitaties'), 'Jane')
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.queryByText('John Smith')).toBeNull()
  })

  it('narrows rows via the phase filter', async () => {
    const user = userEvent.setup()
    mockUseCustomerApplications.mockReturnValue({
      rows: [row(), row({ id: 'app-2', candidateName: 'John Smith', phaseKey: 'hired' })],
      loading: false, error: false,
    })
    render(<CustomerApplicationsList customerId="cust-1" />)
    // Open the shared StatusFilterSelect and pick only "Aangenomen" (hired) —
    // mirrors EntityTasksTab.test.tsx's own open-then-pick interaction.
    await user.click(screen.getByRole('button', { name: /statussen/i }))
    await user.click(await screen.findByRole('button', { name: 'Aangenomen' }))
    expect(screen.getByText('John Smith')).toBeInTheDocument()
    expect(screen.queryByText('Jane Doe')).toBeNull()
  })

  it('clicking a row opens the APPLICATION record, not the candidate/vacancy', async () => {
    const user = userEvent.setup()
    mockUseCustomerApplications.mockReturnValue({ rows: [row()], loading: false, error: false })
    render(<CustomerApplicationsList customerId="cust-1" />)
    // Click the vacancy cell (plain text, not wrapped in its own EntityLink) so
    // only the row-level handler fires, not a second nested click target.
    await user.click(screen.getByText('Verpleegkundige'))
    expect(openEntity).toHaveBeenCalledWith('applications', 'app-1')
  })

  it('passes this customer id and the tenant funnel lookup to the data hook', () => {
    mockUseCustomerApplications.mockReturnValue({ rows: [], loading: false, error: false })
    render(<CustomerApplicationsList customerId="cust-1" />)
    expect(mockUseCustomerApplications).toHaveBeenCalledWith('cust-1', FUNNEL_TYPES)
  })
})

/**
 * SOLLICITATIES-SCOPE-1 — the second entry mode: LocationDetail/DepartmentDetail
 * pass this level's own vacancy ids (already resolved from the Vacatures sub-tab's
 * own scoped query) plus that step's own loading/error, so the two-step chain
 * still renders as ONE coherent state here — same columns/toolbar/row-click as
 * the customerId mode above, only the data SOURCE differs.
 */
// S-custlist-1: every row carries the same action cluster the candidate
// drawer's own application row carries — pencil-edit + expand-with-lazy-detail.
describe('CustomerApplicationsList · action cluster (S-custlist-1)', () => {
  afterEach(() => { vi.doUnmock('@/context/AuthContext'); vi.resetModules() })

  it('renders no actions column without applications.update/.view', async () => {
    vi.resetModules()
    vi.doMock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => false }) }))
    const { default: NoPerm } = await import('./CustomerApplicationsList')
    mockUseCustomerApplications.mockReturnValue({ rows: [row()], loading: false, error: false })
    render(<NoPerm customerId="cust-1" />)
    expect(screen.queryByTitle('Sollicitatie bewerken')).toBeNull()
    expect(screen.queryByTitle('Details tonen')).toBeNull()
  })

  it('pencil opens the reused candidate-drawer edit form; chevron expands the lazy detail panel', async () => {
    const user = userEvent.setup()
    vi.resetModules()
    vi.doMock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
    const { default: WithPerm } = await import('./CustomerApplicationsList')
    mockUseCustomerApplications.mockReturnValue({ rows: [row()], loading: false, error: false })
    render(<WithPerm customerId="cust-1" />)

    // Pencil/chevron never trigger the row's own openEntity click-through.
    await user.click(screen.getByTitle('Sollicitatie bewerken'))
    expect(openEntity).not.toHaveBeenCalled()

    const chevron = screen.getByTitle('Details tonen')
    expect(chevron).toHaveAttribute('aria-expanded', 'false')
    await user.click(chevron)
    expect(screen.getByTitle('Details verbergen')).toHaveAttribute('aria-expanded', 'true')
    expect(openEntity).not.toHaveBeenCalled()
  })
})

// V-appdetail-1: the candidate row shows an inconsistency icon (never colour
// alone, §6) when the application sits at a requires_appointment phase with no
// appointment planned yet.
describe('CustomerApplicationsList · missing-appointment icon (V-appdetail-1)', () => {
  it('shows the icon when missingAppointment is true, hides it otherwise', () => {
    mockUseCustomerApplications.mockReturnValue({
      rows: [row({ missingAppointment: true }), row({ id: 'app-2', candidateName: 'John Smith', missingAppointment: false })],
      loading: false, error: false,
    })
    render(<CustomerApplicationsList customerId="cust-1" />)
    expect(screen.getAllByRole('img', { name: 'In een intakefase, maar nog geen afspraak gepland.' })).toHaveLength(1)
  })
})

describe('CustomerApplicationsList · vacancyIds mode (location/department drill-down)', () => {
  it('fetches through useApplicationsByVacancyIds with this level\'s ids + the tenant funnel lookup', () => {
    mockUseCustomerApplications.mockReturnValue({ rows: [], loading: false, error: false })
    mockUseApplicationsByVacancyIds.mockReturnValue({ rows: [], loading: false, error: false })
    render(<CustomerApplicationsList vacancyIds={['vac-1', 'vac-2']} vacancyIdsLoading={false} />)
    expect(mockUseApplicationsByVacancyIds).toHaveBeenCalledWith(['vac-1', 'vac-2'], FUNNEL_TYPES)
    // The OTHER hook still runs (Rules of Hooks) but with no customer id, so it
    // never fires its own request (useCustomerApplications.test.ts proves that).
    expect(mockUseCustomerApplications).toHaveBeenCalledWith(undefined, FUNNEL_TYPES)
  })

  it('a still-loading step 1 (vacancy id resolution) shows the SAME loading state as step 2', () => {
    mockUseCustomerApplications.mockReturnValue({ rows: [], loading: false, error: false })
    mockUseApplicationsByVacancyIds.mockReturnValue({ rows: [], loading: false, error: false })
    render(<CustomerApplicationsList vacancyIds={[]} vacancyIdsLoading={true} />)
    expect(screen.getByText('Sollicitaties laden…')).toBeInTheDocument()
  })

  it('a step-1 failure lands in the same honest error state as a step-2 failure', () => {
    mockUseCustomerApplications.mockReturnValue({ rows: [], loading: false, error: false })
    mockUseApplicationsByVacancyIds.mockReturnValue({ rows: [], loading: false, error: false })
    render(<CustomerApplicationsList vacancyIds={[]} vacancyIdsLoading={false} vacancyIdsError />)
    expect(screen.getByRole('alert')).toHaveTextContent('Sollicitaties laden is mislukt.')
  })

  it('renders the rows step 2 resolves, once both steps are done', () => {
    mockUseCustomerApplications.mockReturnValue({ rows: [], loading: false, error: false })
    mockUseApplicationsByVacancyIds.mockReturnValue({ rows: [row()], loading: false, error: false })
    render(<CustomerApplicationsList vacancyIds={['vac-1']} vacancyIdsLoading={false} />)
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('Verpleegkundige')).toBeInTheDocument()
  })
})
