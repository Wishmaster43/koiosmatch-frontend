/**
 * CustomerDetailDrawer — now built on the shared ReportDrawerChrome (D1 audit
 * fix) instead of hand-rolling its own backdrop/focus-trap/header shell.
 * Verifies the dialog role/aria-label, the footer close action and the
 * locations/departments body still render as before.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@/i18n'
import CustomerDetailDrawer from './CustomerDetailDrawer'
import type { ReportCustomer } from '@/types/reports'

const customer: ReportCustomer = {
  id: 'c1', name: 'Acme B.V.', status: 'active', debtor_number: 'DEB-1',
  locations: [{ id: 'l1', name: 'Vestiging Noord', status: 'active', departments: [{ id: 'd1', name: 'Logistiek' }] }],
}

describe('CustomerDetailDrawer — shared chrome adoption', () => {
  it('renders as a dialog with the customer name as its aria-label', () => {
    render(<CustomerDetailDrawer customer={customer} onClose={() => {}} />)
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Acme B.V.')
  })

  it('renders the location and its department in the body', () => {
    render(<CustomerDetailDrawer customer={customer} onClose={() => {}} />)
    expect(screen.getByText('Vestiging Noord')).toBeInTheDocument()
    expect(screen.getByText('Logistiek')).toBeInTheDocument()
  })

  it('closes via the footer Close button', () => {
    const onClose = vi.fn()
    render(<CustomerDetailDrawer customer={customer} onClose={onClose} />)
    fireEvent.click(screen.getByText('Sluiten'))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
