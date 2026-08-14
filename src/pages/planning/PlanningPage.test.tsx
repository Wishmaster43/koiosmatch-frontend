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
