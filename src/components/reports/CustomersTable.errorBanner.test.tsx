/**
 * CustomersTable — a failed load renders the shared ErrorBanner atom (role="alert"),
 * not the old hand-rolled danger block with its own lint suppression (D2 audit finding).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@/i18n'
import CustomersTable from './CustomersTable'

vi.mock('./useReportCustomers', () => ({
  useReportCustomers: () => ({ customers: [], loading: false, error: true }),
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))

describe('CustomersTable — load error', () => {
  it('renders the load error via the shared ErrorBanner (role="alert")', () => {
    render(<CustomersTable />)
    const banner = screen.getByRole('alert')
    expect(banner).toHaveTextContent('Kon klanten niet laden.')
  })
})
