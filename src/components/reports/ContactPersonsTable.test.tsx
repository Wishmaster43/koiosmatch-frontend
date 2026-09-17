/**
 * ContactPersonsTable — regression test for the D1 audit fix: the table now
 * renders through the shared reportTableChrome (TH/TD/ReportTableToolbar/
 * ReportRow), the shared Avatar, and the new shared PlanningContactPill
 * instead of hand-duplicated chrome. Verifies the row still renders its
 * fields and still opens the drill-down drawer on click.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@/i18n'
import ContactPersonsTable from './ContactPersonsTable'

vi.mock('@/hooks/useSmCustomerTree', () => ({
  useSmCustomerTree: () => ({
    loading: false,
    customers: [{
      id: 'c1', name: 'Acme B.V.', contacts: [{
        id: 'p1', firstname: 'Jan', lastname: 'Jansen', email: 'jan@acme.test',
        mobile: '0612345678', scheduled_order_contact: true,
      }],
    }],
  }),
}))
vi.mock('@/context/RightPanelContext', () => ({
  useRightPanel: () => ({ registerFilters: vi.fn(), unregisterFilters: vi.fn() }),
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))

describe('ContactPersonsTable — shared chrome adoption', () => {
  it('renders the contact row with customer, name and the planning pill', () => {
    render(<ContactPersonsTable />)
    expect(screen.getByText('Acme B.V.')).toBeInTheDocument()
    expect(screen.getByText('Jan Jansen')).toBeInTheDocument()
    expect(screen.getByText('Ja')).toBeInTheDocument()
  })

  it('opens the drill-down drawer on row click', () => {
    render(<ContactPersonsTable />)
    fireEvent.click(screen.getByText('Jan Jansen').closest('tr')!)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
