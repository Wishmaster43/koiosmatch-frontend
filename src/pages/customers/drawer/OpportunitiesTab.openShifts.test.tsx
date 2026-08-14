/**
 * OpportunitiesTab · open flex shifts section (PLANNING-CONFIG-1).
 *
 * The backend split one 404 into three real states: a genuine error, the honest
 * "no active planning coupling yet" configuration state (still a 200), and a real
 * empty/populated list. This file asserts the tab tells them apart and NEVER hides
 * the section — hiding it would lose a real feature over a configuration state.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import OpportunitiesTab from './OpportunitiesTab'

const { useCustomerOpenShiftsMock } = vi.hoisted(() => ({ useCustomerOpenShiftsMock: vi.fn() }))

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasModule: () => true }) }))
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity: vi.fn() }) }))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => `d(${v})` }) }))
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [] }) }))
vi.mock('../hooks/useCustomerDrawerData', () => ({
  useCustomerOpportunities: () => ({ rows: [], loading: false, error: false, reload: vi.fn() }),
  useCustomerOpenShifts: () => useCustomerOpenShiftsMock(),
}))
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: {} })), delete: vi.fn(() => Promise.resolve({})) },
  getActiveTenantId: vi.fn(() => null),
}))
vi.mock('@/lib/useOpportunityStages', () => ({ useOpportunityStages: () => ({ stages: [] }) }))
vi.mock('@/pages/opportunities/AddOpportunityModal', () => ({ default: () => null }))

beforeEach(() => vi.clearAllMocks())

describe('OpportunitiesTab · open shifts section (PLANNING-CONFIG-1)', () => {
  it('shows the honest "not configured" notice when the backend reports planning_configured: false', () => {
    useCustomerOpenShiftsMock.mockReturnValue({
      rows: [], loading: false, error: false, planningConfigured: false, planningReason: 'Er is nog geen actieve planningskoppeling voor dit bureau.',
    })
    render(<OpportunitiesTab customerId="cust-1" customerName="Acme" />)
    expect(screen.getByText('opportunities.notConfigured')).toBeInTheDocument()
    // The section itself is never hidden — the title still renders.
    expect(screen.getByText('opportunities.openShifts')).toBeInTheDocument()
    // The server's own sentence rides as a tooltip only, never as the headline copy.
    expect(screen.queryByText('Er is nog geen actieve planningskoppeling voor dit bureau.')).not.toBeInTheDocument()
  })

  it('renders the real (empty) list when planning is configured and there are no open shifts', () => {
    useCustomerOpenShiftsMock.mockReturnValue({ rows: [], loading: false, error: false, planningConfigured: true, planningReason: undefined })
    render(<OpportunitiesTab customerId="cust-1" customerName="Acme" />)
    expect(screen.getByText('opportunities.openShiftsEmpty')).toBeInTheDocument()
    expect(screen.queryByText('opportunities.notConfigured')).not.toBeInTheDocument()
  })

  it('renders the real shifts when planning is configured and rows come back', () => {
    useCustomerOpenShiftsMock.mockReturnValue({
      rows: [{ id: 's1', date: '2026-08-20', shift: 'Verpleging 07:00-15:00', department: 'Afdeling A' }],
      loading: false, error: false, planningConfigured: true, planningReason: undefined,
    })
    render(<OpportunitiesTab customerId="cust-1" customerName="Acme" />)
    expect(screen.getByText(/Verpleging/)).toBeInTheDocument()
    expect(screen.queryByText('opportunities.notConfigured')).not.toBeInTheDocument()
  })

  it('shows a genuine error state, never the "not configured" notice, on a real failure (e.g. tenant-isolation 404)', () => {
    useCustomerOpenShiftsMock.mockReturnValue({ rows: [], loading: false, error: true, planningConfigured: true, planningReason: undefined })
    render(<OpportunitiesTab customerId="cust-1" customerName="Acme" />)
    expect(screen.getByText('opportunities.openShiftsError')).toBeInTheDocument()
    expect(screen.queryByText('opportunities.notConfigured')).not.toBeInTheDocument()
  })
})
