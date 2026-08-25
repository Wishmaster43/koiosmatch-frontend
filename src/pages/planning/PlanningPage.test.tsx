/**
 * PlanningPage — two regressions covered:
 *  - PLANNING-PERSIST-1 (CMFE audit 2026-07-28): the honest, translated notice
 *    that the ADD side of this screen (AddShiftModal's Save) still doesn't
 *    persist, so nobody mistakes it for a fully wired calendar.
 *  - the READ side (this follow-up): the shift list/board now comes from
 *    usePlanningBoard (GET /planning/board), not a hardcoded demo array — the
 *    hook itself is mocked here (its own request/mapping contract is covered by
 *    hooks/usePlanningBoard.test.ts) so this file only asserts the page wires
 *    loading/error/success through honestly.
 * react-i18next is mocked to return the raw key so the assertion targets a stable
 * key, not locale copy.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PlanningPage from './PlanningPage'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
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

// Staffing drawer stubbed to a marker so the intent tests can assert it opened
// for the right shift without pulling in its own full data/API wiring.
vi.mock('./ShiftStaffingDrawer', () => ({
  default: ({ shift }: { shift: { id: string } }) => <div data-testid="staffing-drawer">{shift.id}</div>,
}))

describe('PlanningPage · not-yet-persisted gate (PLANNING-PERSIST-1)', () => {
  it('shows the calm notice explaining adding a shift here is not saved yet', () => {
    mockUsePlanningBoard.mockReturnValue({ shifts: [], loading: false, error: false })
    render(<PlanningPage />)
    expect(screen.getByText('previewNotice')).toBeInTheDocument()
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
