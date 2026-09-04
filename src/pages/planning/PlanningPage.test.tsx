/**
 * PlanningPage — regressions covered:
 *  - the READ side: the shift list/board comes from usePlanningBoard
 *    (GET /planning/board), not a hardcoded demo array — the hook itself is
 *    mocked here (its own request/mapping contract is covered by
 *    hooks/usePlanningBoard.test.ts) so this file only asserts the page wires
 *    loading/error/success through honestly.
 *  - PLANNING-PERSIST-1-staart (CMFE audit 2026-09-04): the CREATE side now
 *    really persists (AddShiftModal POSTs /planning/shifts), so the old
 *    page-level "not saved yet" banner is gone — a regression test below pins
 *    that it never comes back.
 *  - ORDERS-PANEL-1 (CMFE audit 2026-09-04): the Orders segment switches this
 *    page into OrdersPanel, wired to the real order list.
 * react-i18next is mocked to return the raw key so the assertion targets a stable
 * key, not locale copy.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PlanningPage from './PlanningPage'
import { useAuth } from '@/context/AuthContext'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
// OPENERS-HIDE-1: wrapped in vi.fn() so the create-gate test below can
// override hasPermission — defaults to true (every other test in this file
// assumes the happy path, unrelated to the create gate).
vi.mock('@/context/AuthContext', () => ({ useAuth: vi.fn(() => ({ hasPermission: () => true })) }))
// Minimal stand-in so the create-gate test can prove the modal opened without
// mounting the real form (its own lookups/API calls are a different file's scope).
vi.mock('./AddShiftModal', () => ({
  default: () => <div data-testid="add-shift-modal" />,
}))
vi.mock('@/context/RightPanelContext', () => ({
  useRightPanel: () => ({ registerFilters: vi.fn(), unregisterFilters: vi.fn() }),
}))
// `@/lib/datetime` transitively imports the real i18n bootstrap (module-scope
// `i18n.use(initReactI18next).init(...)`), which needs the REAL react-i18next
// module — mocking it directly avoids poisoning the react-i18next mock above
// (mirrors MatchModal.test.tsx's identical fix, same reason).
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatTime: (v: string | null) => (v ? `time(${v})` : '') }) }))

const mockUsePlanningBoard = vi.fn()
vi.mock('./hooks/usePlanningBoard', () => ({ usePlanningBoard: (...args: unknown[]) => mockUsePlanningBoard(...args) }))

// Real order list behind the Orders segment (OrdersPanel + AddShiftModal both
// import this) — mocked here so this file stays about PAGE-level wiring; the
// hook's own request shape is covered in ./hooks/usePlanningOrders.test.tsx
// and OrdersPanel's own UI states in ./OrdersPanel.test.tsx.
const mockUsePlanningOrdersList = vi.fn()
vi.mock('./hooks/usePlanningOrders', () => ({
  usePlanningOrdersList: () => mockUsePlanningOrdersList(),
  useDeletePlanningOrder: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

// Staffing drawer stubbed to a marker so the intent tests can assert it opened
// for the right shift without pulling in its own full data/API wiring.
vi.mock('./ShiftStaffingDrawer', () => ({
  default: ({ shift }: { shift: { id: string } }) => <div data-testid="staffing-drawer">{shift.id}</div>,
}))

describe('PlanningPage · create side really persists (PLANNING-PERSIST-1-staart)', () => {
  it('never shows the old "not saved yet" preview banner — Save really POSTs to /planning/shifts now', () => {
    mockUsePlanningBoard.mockReturnValue({ shifts: [], loading: false, error: false })
    mockUsePlanningOrdersList.mockReturnValue({ orders: [], loading: false, error: false })
    render(<PlanningPage />)
    expect(screen.queryByText('previewNotice')).toBeNull()
  })
})

describe('PlanningPage · real shift data (read side)', () => {
  it('shows the loading state while the board fetch is in flight', () => {
    mockUsePlanningBoard.mockReturnValue({ shifts: [], loading: true, error: false })
    render(<PlanningPage />)
    expect(screen.getByText('common:loading')).toBeInTheDocument()
  })

  it('shows the load-error notice when the board fetch fails', () => {
    mockUsePlanningBoard.mockReturnValue({ shifts: [], loading: false, error: true })
    render(<PlanningPage />)
    expect(screen.getByText('loadErrorShifts')).toBeInTheDocument()
  })

  it('renders a real board shift (not a hardcoded demo row)', () => {
    mockUsePlanningBoard.mockReturnValue({
      shifts: [{
        id: 'sh-1', planningOrderId: 'ord-1', function: 'Verzorgende IG', shiftType: 'day',
        startTime: '2026-08-14T07:00:00+02:00', endTime: '2026-08-14T15:00:00+02:00',
        status: 'open', numberPersons: 1, scheduledCount: 0, openSpots: 1, openShift: true,
        assigned: [], customerId: 'cust-1', customer: 'Rivas Zorggroep',
        customerLocationId: null, location: null,
      }],
      loading: false, error: false,
    })
    render(<PlanningPage />)
    // List view renders location alongside title; month's pills stay title-only.
    fireEvent.click(screen.getByText('views.list'))
    expect(screen.getByText('Verzorgende IG')).toBeInTheDocument()
    expect(screen.getByText('Rivas Zorggroep')).toBeInTheDocument()
  })
})

describe('PlanningPage · nav intent (PLANNING-INTENT-1)', () => {
  it('moves the board window to the intent date', () => {
    // Clear prior tests' calls first — this file shares one mock across its
    // describe blocks, and the assertion below checks EVERY call this render made.
    mockUsePlanningBoard.mockClear()
    mockUsePlanningBoard.mockReturnValue({ shifts: [], loading: false, error: false })
    render(<PlanningPage intent={{ date: '2026-09-15' }} />)
    // Month view's window is padded a week either side of the calendar grid
    // (getViewRange) — the last call must cover September 2026, not "today".
    const lastCall = mockUsePlanningBoard.mock.calls.at(-1)
    expect(lastCall).toEqual(['2026-08-25', '2026-10-07'])
    // Lazy-initialising `current` from the intent means EVERY call already
    // carries the intent's window — never a wasted "today" window first.
    for (const call of mockUsePlanningBoard.mock.calls) {
      expect(call).toEqual(['2026-08-25', '2026-10-07'])
    }
  })

  it('opens the staffing drawer for `{ open, date }` only once the board rows contain that shift', () => {
    // First render: the board window hasn't returned the shift yet — the
    // drawer must stay closed rather than pop empty.
    mockUsePlanningBoard.mockReturnValue({ shifts: [], loading: false, error: false })
    const { rerender } = render(<PlanningPage intent={{ open: 'sh-9', date: '2026-09-15' }} />)
    expect(screen.queryByTestId('staffing-drawer')).not.toBeInTheDocument()

    // Board catches up with the shift — the drawer now opens for it.
    mockUsePlanningBoard.mockReturnValue({
      shifts: [{
        id: 'sh-9', planningOrderId: null, function: 'Verzorgende IG', shiftType: 'day',
        startTime: '2026-09-15T07:00:00+02:00', endTime: '2026-09-15T15:00:00+02:00',
        status: 'open', numberPersons: 1, scheduledCount: 0, openSpots: 1, openShift: true,
        assigned: [], customerId: null, customer: null, customerLocationId: null, location: null,
      }],
      loading: false, error: false,
    })
    rerender(<PlanningPage intent={{ open: 'sh-9', date: '2026-09-15' }} />)
    expect(screen.getByTestId('staffing-drawer')).toHaveTextContent('sh-9')
  })
})

// One real order row (PlanningOrderRow shape) reused across the Orders-view
// wiring tests below.
const ORDER_ROW = {
  id: 'o1', customer_id: 'c1', client: 'Rivas Zorggroep', customer_location_id: null,
  location: null, customer_department_id: null, department: null, owner_id: null,
  function: null, reference: null, subject: 'ICU dayshift', description: null,
  cost_center: null, status: 'open', notes: null, shifts_count: 2, created_at: '2026-08-01T00:00:00Z',
}

describe('PlanningPage · Orders view (ORDERS-PANEL-1 wiring)', () => {
  it('switching to the Orders segment renders OrdersPanel, wired to the real order list', () => {
    mockUsePlanningBoard.mockReturnValue({ shifts: [], loading: false, error: false })
    mockUsePlanningOrdersList.mockReturnValue({ orders: [ORDER_ROW], loading: false, error: false })
    render(<PlanningPage />)
    // The Orders segment's accessible name, as the mocked t()=key identity
    // actually renders it — never assumed translated copy.
    fireEvent.click(screen.getByRole('radio', { name: 'views.orders' }))
    expect(mockUsePlanningOrdersList).toHaveBeenCalled()
    expect(screen.getByText('ICU dayshift')).toBeInTheDocument()
  })

  it('shows the honest empty state when there are no real orders yet', () => {
    mockUsePlanningBoard.mockReturnValue({ shifts: [], loading: false, error: false })
    mockUsePlanningOrdersList.mockReturnValue({ orders: [], loading: false, error: false })
    render(<PlanningPage />)
    fireEvent.click(screen.getByRole('radio', { name: 'views.orders' }))
    expect(screen.getByText('order.empty')).toBeInTheDocument()
  })

  it('shows the honest error state when the order list fails to load', () => {
    mockUsePlanningBoard.mockReturnValue({ shifts: [], loading: false, error: false })
    mockUsePlanningOrdersList.mockReturnValue({ orders: [], loading: false, error: true })
    render(<PlanningPage />)
    fireEvent.click(screen.getByRole('radio', { name: 'views.orders' }))
    expect(screen.getByRole('alert')).toHaveTextContent('order.errorList')
  })
})

// hidden without the create permission (OPENERS-HIDE-1, Danny 05-09), same
// as every other page toolbar.
describe('PlanningPage · create gate (OPENERS-HIDE-1)', () => {
  it('hides the "+ addShift" opener without planning.create', () => {
    mockUsePlanningBoard.mockReturnValue({ shifts: [], loading: false, error: false })
    mockUsePlanningOrdersList.mockReturnValue({ orders: [], loading: false, error: false })
    vi.mocked(useAuth).mockReturnValue({ hasPermission: () => false } as unknown as ReturnType<typeof useAuth>)
    render(<PlanningPage />)

    expect(screen.queryByRole('button', { name: 'addShift' })).toBeNull()
  })

  it('shows the opener and opens the modal with planning.create', async () => {
    mockUsePlanningBoard.mockReturnValue({ shifts: [], loading: false, error: false })
    mockUsePlanningOrdersList.mockReturnValue({ orders: [], loading: false, error: false })
    vi.mocked(useAuth).mockReturnValue({ hasPermission: () => true } as unknown as ReturnType<typeof useAuth>)
    const user = userEvent.setup()
    render(<PlanningPage />)

    await user.click(screen.getByRole('button', { name: 'addShift' }))
    expect(screen.getByTestId('add-shift-modal')).toBeInTheDocument()
  })
})
