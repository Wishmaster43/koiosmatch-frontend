/**
 * OrdersPanel — PLANNING-ORDER-CREATE-1 / PLANNING-ORDER-EDIT-1 regression tests.
 * usePlanningOrdersList/useDeletePlanningOrder are mocked (their own request
 * shape is covered in ./hooks/usePlanningOrders.test.tsx); AddOrderModal is
 * mocked to a stub so this file stays focused on the panel's own four UI
 * states plus the edit/delete entry points and the honest 409 message.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OrdersPanel from './OrdersPanel'
import { useAuth } from '@/context/AuthContext'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, opts?: { count?: number }) => opts?.count !== undefined ? `${k}:${opts.count}` : k }) }))
// RIGHTS-GATE-OPENERS-1: wrapped in vi.fn() so the create-gate test below can
// override hasPermission — defaults to true (every other test in this file
// assumes the happy path, unrelated to the create gate).
vi.mock('@/context/AuthContext', () => ({ useAuth: vi.fn(() => ({ hasPermission: () => true })) }))

const mockOrders = vi.fn()
const mockDelete = vi.fn()
// isPending is mutable so the double-click regression test can prove the
// in-flight guard actually reads a live pending state, not a fixed false.
const deleteState = { isPending: false }
vi.mock('./hooks/usePlanningOrders', () => ({
  usePlanningOrdersList: () => mockOrders(),
  useDeletePlanningOrder: () => ({ mutateAsync: mockDelete, get isPending() { return deleteState.isPending } }),
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

beforeEach(() => { vi.clearAllMocks(); deleteState.isPending = false })

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
  // POPUP-AUDIT-1: the hand-rolled centred dialog is now the house ConfirmDialog
  // (FloatingPanel underneath) — drag handle present, same delete request.
  it('renders the delete confirm inside the shared ConfirmDialog/FloatingPanel chrome', async () => {
    const user = userEvent.setup()
    mockOrders.mockReturnValue({ orders: [ROW], loading: false, error: false })
    render(<OrdersPanel />)
    await user.click(screen.getByRole('button', { name: 'common:delete' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(document.querySelector('[data-drag-handle]')).toBeInTheDocument()
  })

  it('confirms and deletes the order', async () => {
    const user = userEvent.setup()
    mockDelete.mockResolvedValue(undefined)
    mockOrders.mockReturnValue({ orders: [ROW], loading: false, error: false })
    render(<OrdersPanel />)
    await user.click(screen.getByRole('button', { name: 'common:delete' }))
    await user.click(screen.getAllByRole('button', { name: 'common:delete' })[1])
    expect(mockDelete).toHaveBeenCalledWith('o1')
  })

  // Verifier fix: ConfirmDialog has no disabled/busy prop, so the confirm button
  // stays clickable while the DELETE is in flight — the panel itself must guard
  // against a second click firing a second DELETE (§3A destructive discipline).
  it('a double click on confirm fires only one DELETE while the mutation is pending', async () => {
    const user = userEvent.setup()
    let resolveDelete: () => void = () => {}
    mockDelete.mockImplementation(() => {
      deleteState.isPending = true
      return new Promise<void>(res => { resolveDelete = () => { deleteState.isPending = false; res() } })
    })
    mockOrders.mockReturnValue({ orders: [ROW], loading: false, error: false })
    render(<OrdersPanel />)
    await user.click(screen.getByRole('button', { name: 'common:delete' }))
    const confirmButton = screen.getAllByRole('button', { name: 'common:delete' })[1]
    await user.click(confirmButton)
    await user.click(confirmButton)
    expect(mockDelete).toHaveBeenCalledTimes(1)
    await act(async () => { resolveDelete() })
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

// RIGHTS-GATE-OPENERS-1: the "+ order.addOrder" opener hides without
// planning.create — never a dead button (§3).
describe('OrdersPanel · create gate (RIGHTS-GATE-OPENERS-1)', () => {
  it('hides the opener without planning.create', () => {
    vi.mocked(useAuth).mockReturnValue({ hasPermission: () => false } as unknown as ReturnType<typeof useAuth>)
    mockOrders.mockReturnValue({ orders: [], loading: false, error: false })
    render(<OrdersPanel />)
    expect(screen.queryByRole('button', { name: 'order.addOrder' })).toBeNull()
  })

  it('shows the opener with planning.create', () => {
    vi.mocked(useAuth).mockReturnValue({ hasPermission: () => true } as unknown as ReturnType<typeof useAuth>)
    mockOrders.mockReturnValue({ orders: [], loading: false, error: false })
    render(<OrdersPanel />)
    expect(screen.getByRole('button', { name: 'order.addOrder' })).toBeInTheDocument()
  })
})

// D9 fix (§4 SOFT-CHIP CONVENTION): the status chip's colour must carry the
// status's own meaning — never the same tenant accent for open/filled/cancelled.
describe('OrdersPanel · status chip colour (§4 soft-chip convention)', () => {
  it('gives open/filled/cancelled distinct semantic colours, not one shared accent', () => {
    mockOrders.mockReturnValue({ orders: [
      { ...ROW, id: 'o1', status: 'open' },
      { ...ROW, id: 'o2', status: 'filled' },
      { ...ROW, id: 'o3', status: 'cancelled' },
    ], loading: false, error: false })
    render(<OrdersPanel />)
    const chips = screen.getAllByText(/order\.status\./)
    const inks = chips.map(c => (c.closest('span') as HTMLElement).style.color)
    // Each status reads its own token, never var(--color-primary) for all three.
    expect(inks[0]).toContain('var(--color-warning)')
    expect(inks[1]).toContain('var(--color-success)')
    expect(inks[2]).toContain('var(--color-danger)')
    expect(new Set(inks).size).toBe(3)
  })
})
