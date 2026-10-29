/**
 * ContactPersonsTable — regression test for the D1 audit fix: the table now
 * renders through the shared reportTableChrome (TH/TD/ReportTableToolbar/
 * ReportRow), the shared Avatar, and the new shared PlanningContactPill
 * instead of hand-duplicated chrome. Verifies the row still renders its
 * fields and still opens the drill-down drawer on click.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import '@/i18n'
import ContactPersonsTable from './ContactPersonsTable'

const h = vi.hoisted(() => ({ registerFilters: vi.fn() }))
vi.mock('@/hooks/useSmCustomerTree', () => ({
  useSmCustomerTree: () => ({
    loading: false,
    customers: [{
      id: 'c1', name: 'Acme B.V.', contacts: [{
        id: 'p1', firstname: 'Jan', lastname: 'Jansen', email: 'jan@acme.test',
        mobile: '0612345678', scheduled_order_contact: true,
      }, {
        id: 'p2', firstname: 'Piet', lastname: 'Pieters', email: 'piet@acme.test',
        mobile: '0687654321', scheduled_order_contact: false,
      }],
    }],
  }),
}))
vi.mock('@/context/RightPanelContext', () => ({
  useRightPanel: () => ({ registerFilters: h.registerFilters, unregisterFilters: vi.fn() }),
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))

describe('ContactPersonsTable — shared chrome adoption', () => {
  it('renders the contact row with customer, name and the planning pill', () => {
    render(<ContactPersonsTable />)
    expect(screen.getAllByText('Acme B.V.').length).toBeGreaterThan(0)
    expect(screen.getByText('Jan Jansen')).toBeInTheDocument()
    expect(screen.getByText('Ja')).toBeInTheDocument()
  })

  it('opens the drill-down drawer on row click', () => {
    render(<ContactPersonsTable />)
    fireEvent.click(screen.getByText('Jan Jansen').closest('tr')!)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('ContactPersonsTable — planning-contact filter', () => {
  beforeEach(() => h.registerFilters.mockClear())

  it('uses English option values and filters to the planning contact', () => {
    render(<ContactPersonsTable />)
    const lastGroups = () => h.registerFilters.mock.calls.at(-1)![1] as Array<{ key: string; options: { value: string }[]; onToggle: (v: string) => void }>
    const group = lastGroups().find(g => g.key === 'planning_contact')!
    expect(group.options.map(o => o.value)).toEqual(['yes', 'no'])
    act(() => group.onToggle('yes'))
    expect(screen.getByText('Jan Jansen')).toBeInTheDocument()
    expect(screen.queryByText('Piet Pieters')).toBeNull()
  })
})
