/**
 * LocationsTable — regression test for a swapped cell/header order: the
 * customer name must render under the "Klant" column and the location name
 * under "Locatie", matching COLS' declared order (D8 audit finding).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@/i18n'
import LocationsTable from './LocationsTable'

vi.mock('@/hooks/useSmCustomerTree', () => ({
  useSmCustomerTree: () => ({
    loading: false,
    customers: [{
      id: 'c1', name: 'Acme Klant', locations: [{
        id: 'l1', name: 'Vestiging Noord', status: 'active', departments: [],
      }],
    }],
  }),
}))
vi.mock('@/context/RightPanelContext', () => ({
  useRightPanel: () => ({ registerFilters: vi.fn(), unregisterFilters: vi.fn() }),
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))

describe('LocationsTable — cell order matches header order', () => {
  it('renders the customer name under the first ("Klant") column and the location name under the second ("Locatie")', () => {
    render(<LocationsTable />)
    const row = screen.getByText('Vestiging Noord').closest('tr')!
    const cells = row.querySelectorAll('td')
    expect(cells[0]).toHaveTextContent('Acme Klant')
    expect(cells[1]).toHaveTextContent('Vestiging Noord')
  })
})
