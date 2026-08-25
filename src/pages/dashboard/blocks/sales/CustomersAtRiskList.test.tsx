/**
 * CustomersAtRiskList — asserts rows render via the shared WidgetListBlock row
 * shape, and a row click opens the customer's drawer.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CustomersAtRiskList from './CustomersAtRiskList'
import type { CustomerAtRiskRow } from '@/types/dashboard'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, opts?: { count?: number }) => opts ? `${k}:${opts.count}` : k }) }))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: () => '01-06-2026' }) }))

const rows: CustomerAtRiskRow[] = [
  { id: 'c1', name: 'Acme BV', owner: 'Bob', last_contact_at: '2026-06-01', days_quiet: 40 },
]

describe('CustomersAtRiskList', () => {
  it('renders the customer row', () => {
    render(<CustomersAtRiskList rows={rows} onNavigate={vi.fn()} />)
    expect(screen.getByText('Acme BV')).toBeInTheDocument()
  })

  it('composes the days-quiet + last-contact-date meta string', () => {
    render(<CustomersAtRiskList rows={rows} onNavigate={vi.fn()} />)
    expect(screen.getByText('feed.daysQuiet:40 · 01-06-2026')).toBeInTheDocument()
  })

  it('omits the date fragment when last_contact_at is absent', () => {
    const noContact: CustomerAtRiskRow[] = [{ id: 'c2', name: 'Beta BV', owner: 'Bob', last_contact_at: null, days_quiet: 5 }]
    render(<CustomersAtRiskList rows={noContact} onNavigate={vi.fn()} />)
    expect(screen.getByText('feed.daysQuiet:5')).toBeInTheDocument()
  })

  it('navigates to the customer drawer on click', () => {
    const onNavigate = vi.fn()
    render(<CustomersAtRiskList rows={rows} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByText('Acme BV'))
    expect(onNavigate).toHaveBeenCalledWith('customers', { open: 'c1' })
  })

  it('self-hides on an empty feed', () => {
    const { container } = render(<CustomersAtRiskList rows={[]} onNavigate={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})
