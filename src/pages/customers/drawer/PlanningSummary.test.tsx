/**
 * PlanningSummary · PLANNING-CONFIG-1: the "not configured yet" split.
 * Same guarantees as OpportunitiesTab.openShifts.test.tsx, for the other consumer
 * of the split routes (GET /customers/{id}/planning-summary).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import PlanningSummary from './PlanningSummary'

const { useCustomerPlanningMock } = vi.hoisted(() => ({ useCustomerPlanningMock: vi.fn() }))

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasModule: () => true }) }))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => `d(${v})` }) }))
vi.mock('../hooks/useCustomerDrawerData', () => ({ useCustomerPlanning: () => useCustomerPlanningMock() }))

beforeEach(() => vi.clearAllMocks())

describe('PlanningSummary (PLANNING-CONFIG-1)', () => {
  it('shows the honest "not configured" notice, own translated copy, when planning_configured is false', () => {
    useCustomerPlanningMock.mockReturnValue({
      data: null, loading: false, error: false, planningConfigured: false,
      planningReason: 'Er is nog geen actieve planningskoppeling voor dit bureau.',
    })
    render(<PlanningSummary customerId="cust-1" />)
    expect(screen.getByText('planning.notConfigured')).toBeInTheDocument()
    expect(screen.queryByText('Er is nog geen actieve planningskoppeling voor dit bureau.')).not.toBeInTheDocument()
  })

  it('renders the real summary (active_now + upcoming) when planning is configured', () => {
    useCustomerPlanningMock.mockReturnValue({
      data: { active_now: 3, upcoming: [] }, loading: false, error: false, planningConfigured: true, planningReason: undefined,
    })
    render(<PlanningSummary customerId="cust-1" />)
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('planning.upcomingEmpty')).toBeInTheDocument()
    expect(screen.queryByText('planning.notConfigured')).not.toBeInTheDocument()
  })

  it('shows a genuine error state, never the "not configured" notice, on a real failure', () => {
    useCustomerPlanningMock.mockReturnValue({ data: null, loading: false, error: true, planningConfigured: true, planningReason: undefined })
    render(<PlanningSummary customerId="cust-1" />)
    expect(screen.getByText('planning.loadError')).toBeInTheDocument()
    expect(screen.queryByText('planning.notConfigured')).not.toBeInTheDocument()
  })
})
