/**
 * AddShiftOrderColumn — D8 regression: the fAssignment/fContact inputs, the
 * address textarea and the colour swatches used to render with no state,
 * onChange or save-payload destination at all (NO-FAKE-AFFORDANCE, §3) — this
 * pins that they are gone, not merely disabled, and that the real order/
 * customer/department pickers still work.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import AddShiftOrderColumn from './AddShiftOrderColumn'

const t = (k: string) => k

const baseProps = {
  t, orderId: '', handleOrderChange: vi.fn(),
  orders: [], ordersLoading: false, ordersError: false,
  customerId: '', handleCustomerChange: vi.fn(),
  customers: [], customersLoading: false, customersError: false,
  departmentId: '', setDepartmentId: vi.fn(),
  departments: [], departmentsLoading: false, departmentsError: false, departmentCustomerId: '',
}

describe('AddShiftOrderColumn · dead fields removed (D8 NO-FAKE-AFFORDANCE)', () => {
  it('renders only the real order/customer/department pickers — no assignment/contact/address/colour dead ends', () => {
    render(<AddShiftOrderColumn {...baseProps} />)
    expect(screen.getByText('sectionOrder')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'order.listTitle' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'fCustomer' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'fDepartment' })).toBeInTheDocument()
    // The dropped fields no longer exist anywhere in the column.
    expect(screen.queryByText('sectionLocation')).not.toBeInTheDocument()
    expect(screen.queryByText('sectionColor')).not.toBeInTheDocument()
    expect(screen.queryByText('fAssignment')).not.toBeInTheDocument()
    expect(screen.queryByText('fContact')).not.toBeInTheDocument()
    expect(screen.queryByText('fAddress')).not.toBeInTheDocument()
  })
})
