/**
 * OrdersPanel — PLANNING-ORDER-CREATE-1 / PLANNING-ORDER-EDIT-1 regression tests.
 * usePlanningOrdersList/useDeletePlanningOrder are mocked (their own request
 * shape is covered in ./hooks/usePlanningOrders.test.tsx); AddOrderModal is
 * mocked to a stub so this file stays focused on the panel's own four UI
 * states plus the edit/delete entry points and the honest 409 message.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OrdersPanel from './OrdersPanel'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, opts?: { count?: number }) => opts?.count !== undefined ? `${k}:${opts.count}` : k }) }))

const mockOrders = vi.fn()
const mockDelete = vi.fn()
vi.mock('./hooks/usePlanningOrders', () => ({
  usePlanningOrdersList: () => mockOrders(),
  useDeletePlanningOrder: () => ({ mutateAsync: mockDelete, isPending: false }),
}))

vi.mock('./AddOrderModal', () => ({
  default: ({ onClose, order }: { onClose: () => void; order?: { id: string; subject?: string | null } }) => (
    <div data-testid="add-order-modal" data-editing-id={order?.id ?? ''}>
      {order ? `editing:${order.subject}` : 'creating'}
      <button onClick={onClose}>close</button>
    </div>
  ),
}))

const ROW = { id: 'o1', client: 'Rivas Zorggroep', location: 'Locatie A', department: null,
  subject: 'ICU dayshift', function: null, reference: null, status: 'open', shifts_count: 2 }

beforeEach(() => vi.clearAllMocks())

describe('OrdersPanel · four UI states', () => {
  it('loading', () => {
    mockOrders.mockReturnValue({ orders: [], loading: true, error: false })
    render(<OrdersPanel />)
    expect(screen.getByText('common:loading')).toBeInTheDocument()
  })

  it('error', () => {
    mockOrders.mockReturnValue({ orders: [], loading: false, error: true })
    render(<OrdersPanel />)
    expect(screen.getByRole('alert')).toHaveTextContent('order.errorList')
  })

  it('empty — no fabricated rows', () => {
    mockOrders.mockReturnValue({ orders: [], loading: false, error: false })
    render(<OrdersPanel />)
    expect(screen.getByText('order.empty')).toBeInTheDocument()
  })

  it('success — renders the real order with its shift count', () => {
    mockOrders.mockReturnValue({ orders: [ROW], loading: false, error: false })
    render(<OrdersPanel />)
    expect(screen.getByText('ICU dayshift')).toBeInTheDocument()
    expect(screen.getByText('order.shiftsCount:2')).toBeInTheDocument()
  })
})

describe('OrdersPanel · edit entry point', () => {
  it('opens AddOrderModal seeded with the clicked order', async () => {
    const user = userEvent.setup()
    mockOrders.mockReturnValue({ orders: [ROW], loading: false, error: false })
    render(<OrdersPanel />)
    await user.click(screen.getByRole('button', { name: 'common:edit' }))
    expect(screen.getByTestId('add-order-modal')).toHaveAttribute('data-editing-id', 'o1')
    expect(screen.getByText('editing:ICU dayshift')).toBeInTheDocument()
  })
})

describe('OrdersPanel · delete + honest 409', () => {
  it('confirms and deletes the order', async () => {
    const user = userEvent.setup()
    mockDelete.mockResolvedValue(undefined)
    mockOrders.mockReturnValue({ orders: [ROW], loading: false, error: false })
    render(<OrdersPanel />)
    await user.click(screen.getByRole('button', { name: 'common:delete' }))
    await user.click(screen.getAllByRole('button', { name: 'common:delete' })[1])
    expect(mockDelete).toHaveBeenCalledWith('o1')
  })

  it('shows the real "cancel its shifts first" reason on a 409, not a generic failure', async () => {
    const user = userEvent.setup()
    mockDelete.mockRejectedValue({ response: { data: { message: 'Cannot delete an order with active shifts. Cancel its shifts first.' } } })
    mockOrders.mockReturnValue({ orders: [ROW], loading: false, error: false })
    render(<OrdersPanel />)
    await user.click(screen.getByRole('button', { name: 'common:delete' }))
    const dialog = screen.getByRole('dialog')
    await user.click(screen.getAllByRole('button', { name: 'common:delete' })[1])
    expect(await screen.findByText('Cannot delete an order with active shifts. Cancel its shifts first.')).toBeInTheDocument()
    expect(dialog).toBeInTheDocument()
  })
})
