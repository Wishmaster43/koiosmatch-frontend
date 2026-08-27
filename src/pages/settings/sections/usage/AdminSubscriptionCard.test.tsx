/**
 * AdminSubscriptionCard pins (BILLING-FACTUUR-1): the d6629eb4 subscription
 * block renders in euros, the over-limit line appears ONLY above the included
 * user count, and an older BE without the block renders nothing.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@/i18n'
import AdminSubscriptionCard from './AdminSubscriptionCard'

const sub = {
  package: 'pro', base_amount: 995.0,
  users: { included: 5, active: 8, extra: 3, extra_amount: 465.0 },
  addons: [{ key: 'plan', amount: 49.0 }],
  total_amount: 1509.0,
}

describe('AdminSubscriptionCard', () => {
  it('renders nothing without the subscription block (older BE)', () => {
    const { container } = render(<AdminSubscriptionCard subscription={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the split in euros with the honest over-limit line', () => {
    render(<AdminSubscriptionCard subscription={sub} />)
    expect(screen.getByText('Abonnement')).toBeInTheDocument()
    expect(screen.getByText('€ 995,00')).toBeInTheDocument()
    expect(screen.getByText('8 gebruikers (5 inbegrepen)')).toBeInTheDocument()
    expect(screen.getByText('€ 465,00')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('3 gebruikers boven het pakket')
    expect(screen.getByText('€ 1.509,00')).toBeInTheDocument()
  })

  it('shows no over-limit line when the tenant sits within its package', () => {
    render(<AdminSubscriptionCard subscription={{ ...sub, users: { included: 5, active: 4, extra: 0, extra_amount: 0 } }} />)
    expect(screen.queryByRole('status')).toBeNull()
  })
})
