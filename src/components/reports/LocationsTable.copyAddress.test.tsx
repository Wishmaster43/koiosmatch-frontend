/**
 * LocationsTable — the address cell's copy-icon affordance (representative
 * table-cell apply site for CopyIconButton). Verifies the composed address
 * copies to the clipboard without also triggering the row's drill-down click.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@/i18n'
import LocationsTable from './LocationsTable'

vi.mock('@/hooks/useSmCustomerTree', () => ({
  useSmCustomerTree: () => ({
    loading: false,
    customers: [{
      id: 'c1', name: 'Acme', locations: [{
        id: 'l1', name: 'Vestiging Noord', status: 'active',
        street: 'Kerkstraat', house_number: '12', postal_code: '1234 AB', city: 'Utrecht',
        departments: [],
      }],
    }],
  }),
}))
vi.mock('@/context/RightPanelContext', () => ({
  useRightPanel: () => ({ registerFilters: vi.fn(), unregisterFilters: vi.fn() }),
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))

describe('LocationsTable — address cell copy icon', () => {
  it('copies the composed address without opening the drill-down drawer', async () => {
    // userEvent.setup() installs its own in-memory clipboard stub — spy AFTER
    // setup so the spy wraps that stub instead of being overwritten by it.
    const user = userEvent.setup()
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText')
    render(<LocationsTable />)

    expect(screen.getByText('Kerkstraat 12 1234 AB Utrecht')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /kopieer|copy/i }))

    expect(writeTextSpy).toHaveBeenCalledWith('Kerkstraat 12 1234 AB Utrecht')
    // The row's own drill-down drawer must not have opened as a side effect
    // (it renders a dialog with departments count when opened).
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
