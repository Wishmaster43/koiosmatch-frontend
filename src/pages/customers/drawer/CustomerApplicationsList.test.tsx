/**
 * CustomerApplicationsList — the Sollicitaties sub-tab's own render coverage:
 * columns (candidate/vacancy/phase/score/created), the phase filter narrowing
 * rows, free-text search, the four explicit UI states, and the row click
 * opening the application (never the candidate/vacancy on either side of it).
 * The FETCH shape itself is proven separately (useCustomerApplications.test.ts,
 * mirrors MatchesTab.test.tsx deferring to useCustomerMatches.test.ts) — this
 * file stubs that hook so it only tests rendering, not the network seam.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@/i18n'
import CustomerApplicationsList from './CustomerApplicationsList'
import type { Application } from '@/types/application'

const mockUseCustomerApplications = vi.fn()
vi.mock('../hooks/useCustomerDrawerData', () => ({
  useCustomerApplications: (...args: unknown[]) => mockUseCustomerApplications(...args),
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

const row = (over: Partial<Application> = {}): Application => ({
  id: 'app-1', candidateId: 'cand-1', candidateName: 'Jane Doe', candidateInitials: 'JD',
  vacancyId: 'vac-1', vacancyTitle: 'Verpleegkundige', client: 'Acme', customerId: 'cust-1',
  referenceNumber: 'S-001', score: 82, task: '', phaseKey: 'applied', bucket: 'active',
  interview: null, source: '', owner: { id: null, name: '', initials: '', color: null },
  candidateStatusLabel: '', candidateStatusColor: 'var(--text-muted)', candidateStatus: '', candidatePhase: '',
  created: '2026-07-01', isNew: false, archived: false, deletedAt: null, currentStageEnteredAt: null,
  ...over,
})

afterEach(() => cleanup())
beforeEach(() => vi.clearAllMocks())

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
