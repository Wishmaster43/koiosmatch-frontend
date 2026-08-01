/**
 * OpportunitiesTab · "+ Nieuwe kans" trigger (Danny 27-07: "+ Nieuwe kans moet
 * een knopje zijn zoals ook bij de kandidaat drill down!!") — covers only the
 * house-button swap: the bare text+Plus link is now the shared DrawerAddButton,
 * same onClick (opens AddOpportunityModal, prefilled with this customer). The
 * modal itself is a different file's scope (its own lookup/cascade hooks) —
 * stood in with a marker, mirroring WorkTab.test.tsx's MatchModal stub.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OpportunitiesTab from './OpportunitiesTab'

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasModule: () => false }) }))
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity: vi.fn() }) }))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => `d(${v})` }) }))
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [] }) }))
vi.mock('../hooks/useCustomerDrawerData', () => ({
  useCustomerOpportunities: () => ({ rows: [], loading: false, error: false, reload: vi.fn() }),
  useCustomerOpenShifts: () => ({ rows: [], loading: false }),
}))
// AddOpportunityModal is a different file's scope (lookup/cascade hooks) — a
// marker exposing `defaultCustomerId` proves the "+" trigger's dialog-opens
// wiring without mounting the real form.
vi.mock('@/pages/opportunities/AddOpportunityModal', () => ({
  default: ({ defaultCustomerId }: { defaultCustomerId?: string | number }) => (
    <div data-testid="add-opportunity-modal" data-default-customer-id={defaultCustomerId ?? ''} />
  ),
}))

describe('OpportunitiesTab · "+ Nieuwe kans" trigger (Danny 27-07: house button, not a bare text link)', () => {
  it('does not render the modal until the trigger is clicked', () => {
    render(<OpportunitiesTab customerId="cust-1" customerName="Acme" />)
    expect(screen.queryByTestId('add-opportunity-modal')).not.toBeInTheDocument()
  })

  it('opens AddOpportunityModal, prefilled with this customer, when the house button is clicked', async () => {
    const user = userEvent.setup()
    render(<OpportunitiesTab customerId="cust-1" customerName="Acme" />)
    await user.click(screen.getByRole('button', { name: 'opportunities.newOpportunity' }))
    expect(screen.getByTestId('add-opportunity-modal')).toHaveAttribute('data-default-customer-id', 'cust-1')
  })
})
